-- 002: quantity-based multi-receiver claiming
-- 1. Track remaining quantity on each donation
alter table public.donations add column if not exists remaining_quantity numeric;
update public.donations set remaining_quantity = case when status = 'available' then quantity else 0 end where remaining_quantity is null;
alter table public.donations drop constraint if exists donations_remaining_quantity_check;
alter table public.donations add constraint donations_remaining_quantity_check check (remaining_quantity >= 0);

create or replace function public.set_remaining_quantity()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.remaining_quantity is null then new.remaining_quantity := new.quantity; end if;
  return new;
end $$;
drop trigger if exists donations_set_remaining on public.donations;
create trigger donations_set_remaining before insert on public.donations
  for each row execute function public.set_remaining_quantity();

-- Only RPCs (app.rpc = 'on') or admins may change remaining_quantity.
create or replace function public.guard_donation_remaining()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and new.remaining_quantity is distinct from old.remaining_quantity
     and coalesce(current_setting('app.rpc', true), '') <> 'on' then
    raise exception 'not allowed';
  end if;
  return new;
end $$;
drop trigger if exists donations_guard_remaining on public.donations;
create trigger donations_guard_remaining before update on public.donations
  for each row execute function public.guard_donation_remaining();

-- 2. Portion requested per receiver
alter table public.food_requests add column if not exists requested_quantity numeric not null default 0 check (requested_quantity >= 0);

-- 3. Atomic quantity claim. Row lock on the donation serialises concurrent claims.
create or replace function public.claim_donation_quantity(p_donation_id uuid, p_quantity numeric, p_message text default null)
returns public.food_requests
language plpgsql security definer set search_path = public as $$
declare
  v_uid      uuid := auth.uid();
  v_profile  public.profiles%rowtype;
  v_donation public.donations%rowtype;
  v_request  public.food_requests%rowtype;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found or v_profile.role <> 'receiver' or v_profile.is_suspended then
    raise exception 'not allowed';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'enter a quantity greater than zero';
  end if;

  select * into v_donation from public.donations where id = p_donation_id for update;
  if not found then raise exception 'donation not found'; end if;
  if v_donation.status <> 'available' then raise exception 'this donation is fully claimed or no longer available'; end if;
  if v_donation.expires_at <= now() then raise exception 'donation has expired'; end if;
  if coalesce(v_donation.remaining_quantity, 0) <= 0 then raise exception 'no food remaining for this donation'; end if;
  if p_quantity > v_donation.remaining_quantity then
    raise exception 'only % % remaining', v_donation.remaining_quantity, coalesce(v_donation.unit, '');
  end if;

  if exists (
    select 1 from public.food_requests
    where donation_id = p_donation_id and receiver_id = v_uid
      and status not in ('rejected','cancelled','failed')
  ) then
    raise exception 'you already have an active request for this donation';
  end if;

  insert into public.food_requests (donation_id, receiver_id, donor_id, status, message, requested_quantity)
  values (p_donation_id, v_uid, v_donation.donor_id, 'pending', p_message, p_quantity)
  returning * into v_request;

  perform set_config('app.rpc', 'on', true);
  update public.donations
     set remaining_quantity = remaining_quantity - p_quantity,
         status = case when remaining_quantity - p_quantity <= 0 then 'claimed' else status end
   where id = p_donation_id;

  insert into public.notifications (user_id, type, message, related_table, related_id)
  values (
    v_donation.donor_id, 'new_request',
    'A receiver requested ' || p_quantity || ' ' || coalesce(v_donation.unit, '') || ' of "' || coalesce(v_donation.title, '') || '".',
    'food_requests', v_request.id
  );

  return v_request;
end $$;

-- 4. Old single-claim entry point now claims the whole remaining amount through the same atomic path.
create or replace function public.claim_donation(p_donation_id uuid, p_message text default null)
returns public.food_requests
language plpgsql security definer set search_path = public as $$
declare v_remaining numeric;
begin
  select remaining_quantity into v_remaining from public.donations where id = p_donation_id;
  if not found then raise exception 'donation not found'; end if;
  return public.claim_donation_quantity(p_donation_id, v_remaining, p_message);
end $$;

-- 5. Rejecting a pending request returns its portion to the pool and reopens a fully claimed donation.
create or replace function public.restore_quantity_on_reject()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'rejected' and old.status = 'pending' then
    perform set_config('app.rpc', 'on', true);
    update public.donations
       set remaining_quantity = remaining_quantity + new.requested_quantity,
           status = case when status = 'claimed' and remaining_quantity + new.requested_quantity > 0 and expires_at > now()
                         then 'available' else status end
     where id = new.donation_id;
  end if;
  return new;
end $$;
drop trigger if exists food_requests_restore_on_reject on public.food_requests;
create trigger food_requests_restore_on_reject after update of status on public.food_requests
  for each row execute function public.restore_quantity_on_reject();

-- 6. Donor-side list of every request on the donor's donations, with receiver details.
create or replace function public.list_donor_requests()
returns table (
  request_id uuid, donation_id uuid, donation_title text, donation_unit text,
  donation_quantity numeric, donation_remaining numeric, donation_status text,
  receiver_id uuid, receiver_name text, receiver_organization text, receiver_city text, receiver_phone text,
  requested_quantity numeric, request_status text, request_message text, requested_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select fr.id, d.id, d.title, d.unit, d.quantity, d.remaining_quantity, d.status,
         p.id, p.full_name, p.organization_name, p.city, p.phone,
         fr.requested_quantity, fr.status, fr.message, fr.created_at
    from public.food_requests fr
    join public.donations d on d.id = fr.donation_id
    join public.profiles p on p.id = fr.receiver_id
   where fr.donor_id = auth.uid()
   order by fr.created_at desc;
$$;

-- 7. Grants
revoke all on function public.claim_donation_quantity(uuid, numeric, text) from public, anon;
grant execute on function public.claim_donation_quantity(uuid, numeric, text) to authenticated;
revoke all on function public.claim_donation(uuid, text) from public, anon;
grant execute on function public.claim_donation(uuid, text) to authenticated;
revoke all on function public.list_donor_requests() from public, anon;
grant execute on function public.list_donor_requests() to authenticated;

-- 8. Realtime so receivers and donors see quantity changes live
do $$ begin alter publication supabase_realtime add table public.donations; exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.food_requests; exception when duplicate_object then null; when undefined_object then null; end $$;
