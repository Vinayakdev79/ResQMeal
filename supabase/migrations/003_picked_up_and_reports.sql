-- 003: donor marks an accepted pickup as picked up (food distributed) and exposes completed distributions.
create or replace function public.mark_picked_up(p_request_id uuid)
returns public.food_requests
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_req public.food_requests%rowtype;
  v_don public.donations%rowtype;
  v_open int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_req from public.food_requests where id = p_request_id for update;
  if not found then raise exception 'request not found'; end if;
  if v_req.donor_id <> v_uid and not public.is_admin() then raise exception 'not allowed'; end if;
  if v_req.status not in ('accepted','pickup_scheduled') then
    raise exception 'only accepted pickups can be marked picked up';
  end if;
  perform set_config('app.rpc', 'on', true);
  update public.food_requests
     set status = 'completed',
         completed_at = now(),
         collected_at = coalesce(collected_at, now()),
         quantity_collected = coalesce(quantity_collected, requested_quantity),
         updated_at = now()
   where id = p_request_id
  returning * into v_req;
  select * into v_don from public.donations where id = v_req.donation_id for update;
  select count(*) into v_open from public.food_requests
   where donation_id = v_don.id and status in ('pending','accepted','pickup_scheduled','collected');
  if v_open = 0 and coalesce(v_don.remaining_quantity, 0) <= 0 then
    update public.donations set status = 'completed', updated_at = now() where id = v_don.id;
  end if;
  insert into public.notifications (user_id, type, message, related_table, related_id)
  values (v_req.receiver_id, 'completed',
          'Your pickup of "' || coalesce(v_don.title, '') || '" is complete.', 'food_requests', v_req.id);
  return v_req;
end $$;

create or replace function public.list_completed_distributions()
returns table (
  request_id uuid, donation_id uuid, donation_title text, donation_category text, unit text,
  quantity_distributed numeric, receiver_name text, receiver_organization text,
  donor_name text, completed_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select fr.id, d.id, d.title, d.category, d.unit,
         coalesce(fr.quantity_collected, fr.requested_quantity),
         rp.full_name, rp.organization_name, dp.full_name, fr.completed_at
    from public.food_requests fr
    join public.donations d on d.id = fr.donation_id
    join public.profiles rp on rp.id = fr.receiver_id
    join public.profiles dp on dp.id = fr.donor_id
   where fr.status = 'completed'
     and (fr.donor_id = auth.uid() or fr.receiver_id = auth.uid() or public.is_admin())
   order by fr.completed_at desc;
$$;

revoke all on function public.mark_picked_up(uuid) from public, anon;
grant execute on function public.mark_picked_up(uuid) to authenticated;
revoke all on function public.list_completed_distributions() from public, anon;
grant execute on function public.list_completed_distributions() to authenticated;
