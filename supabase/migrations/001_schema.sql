-- =============================================================================
-- ResQMeal - 001_schema.sql
-- Idempotent schema, RLS, triggers, RPCs, storage and grants for Supabase.
-- Run in the Supabase SQL Editor. Safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  role              text not null default 'receiver' check (role in ('donor','receiver','admin')),
  full_name         text,
  phone             text,
  organization_name text,
  org_type          text,
  address_line      text,
  city              text,
  state             text,
  pin_code          text,
  location_label    text,
  latitude          numeric,
  longitude         numeric,
  people_served     int,
  is_verified       boolean not null default false,
  is_suspended      boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.donations (
  id                   uuid primary key default gen_random_uuid(),
  donor_id             uuid references public.profiles(id) on delete cascade,
  title                text,
  category             text,
  description          text,
  quantity             numeric check (quantity > 0),
  unit                 text,
  estimated_people     int check (estimated_people > 0),
  prepared_at          timestamptz null,
  expires_at           timestamptz not null,
  pickup_window_start  timestamptz,
  pickup_window_end    timestamptz,
  constraint donations_pickup_window_check check (pickup_window_end > pickup_window_start),
  image_url            text null,
  pickup_address       text,
  pickup_city          text,
  pickup_state         text,
  pickup_pin_code      text,
  latitude             numeric,
  longitude            numeric,
  is_vegetarian        boolean,
  special_instructions text,
  allocation_mode      text not null default 'single' check (allocation_mode in ('single','multiple')),
  status               text not null default 'available' check (status in ('available','claimed','pickup_scheduled','completed','expired','cancelled','removed')),
  claimed_by           uuid null references public.profiles(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists donations_status_idx     on public.donations (status);
create index if not exists donations_expires_at_idx on public.donations (expires_at);
create index if not exists donations_donor_id_idx   on public.donations (donor_id);
create index if not exists donations_lat_lng_idx    on public.donations (latitude, longitude);

create table if not exists public.food_requests (
  id                   uuid primary key default gen_random_uuid(),
  donation_id          uuid references public.donations(id) on delete cascade,
  receiver_id          uuid references public.profiles(id) on delete cascade,
  donor_id             uuid references public.profiles(id) on delete cascade,
  status               text not null default 'pending' check (status in ('pending','accepted','rejected','pickup_scheduled','collected','completed','cancelled','failed')),
  pickup_scheduled_at  timestamptz null,
  collected_at         timestamptz null,
  completed_at         timestamptz null,
  quantity_collected   numeric null,
  message              text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create unique index if not exists food_requests_active_unique
  on public.food_requests (donation_id, receiver_id)
  where status not in ('rejected','cancelled','failed');

create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete cascade,
  type          text,
  message       text,
  related_table text,
  related_id    uuid,
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid references public.profiles(id),
  reported_user_id uuid null references public.profiles(id),
  donation_id      uuid null references public.donations(id),
  reason           text,
  details          text,
  status           text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  resolution_note  text,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);

create table if not exists public.admin_logs (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid references public.profiles(id),
  action       text,
  target_table text,
  target_id    uuid,
  details      jsonb,
  created_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. Helper functions
-- -----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Generic updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Signup: create the profile from auth metadata.
-- 'admin' can never be granted through signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (
    id, role, full_name, phone, organization_name, org_type,
    address_line, city, state, pin_code, location_label,
    latitude, longitude, people_served
  )
  values (
    new.id,
    case when v_meta->>'role' in ('donor','receiver') then v_meta->>'role' else 'receiver' end,
    nullif(v_meta->>'full_name', ''),
    nullif(v_meta->>'phone', ''),
    nullif(v_meta->>'organization_name', ''),
    nullif(v_meta->>'org_type', ''),
    nullif(v_meta->>'address_line', ''),
    nullif(v_meta->>'city', ''),
    nullif(v_meta->>'state', ''),
    nullif(v_meta->>'pin_code', ''),
    nullif(v_meta->>'location_label', ''),
    nullif(v_meta->>'latitude', '')::numeric,
    nullif(v_meta->>'longitude', '')::numeric,
    nullif(v_meta->>'people_served', '')::int
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may not change their own role / verification / suspension flags.
create or replace function public.guard_profile_privileged_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() and (
       new.role is distinct from old.role
    or new.is_verified is distinct from old.is_verified
    or new.is_suspended is distinct from old.is_suspended
  ) then
    raise exception 'not allowed';
  end if;
  return new;
end;
$$;

-- Donation status changes are only allowed through RPCs (app.rpc = 'on'),
-- admins, or a donor cancelling their own donation.
create or replace function public.guard_donation_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and new.status is distinct from old.status
     and new.status not in ('cancelled')
     and coalesce(current_setting('app.rpc', true), '') <> 'on' then
    raise exception 'not allowed';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Triggers
-- -----------------------------------------------------------------------------

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_fields();

drop trigger if exists donations_set_updated_at on public.donations;
create trigger donations_set_updated_at
  before update on public.donations
  for each row execute function public.set_updated_at();

drop trigger if exists donations_guard_status on public.donations;
create trigger donations_guard_status
  before update on public.donations
  for each row execute function public.guard_donation_status();

drop trigger if exists food_requests_set_updated_at on public.food_requests;
create trigger food_requests_set_updated_at
  before update on public.food_requests
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.donations     enable row level security;
alter table public.food_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.reports       enable row level security;
alter table public.admin_logs    enable row level security;

-- profiles
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (
    id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.food_requests fr
      where (fr.donor_id = auth.uid() and fr.receiver_id = profiles.id)
         or (fr.receiver_id = auth.uid() and fr.donor_id = profiles.id)
    )
  );

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- donations
drop policy if exists "donations_select" on public.donations;
create policy "donations_select" on public.donations
  for select to authenticated using (
    status in ('available','claimed','pickup_scheduled','completed')
    or donor_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "donations_insert" on public.donations;
create policy "donations_insert" on public.donations
  for insert with check (donor_id = auth.uid());

-- with check is widened so a donor can cancel (status 'cancelled') their own donation
drop policy if exists "donations_update" on public.donations;
create policy "donations_update" on public.donations
  for update using (
    (donor_id = auth.uid() and status = 'available') or public.is_admin()
  ) with check (
    (donor_id = auth.uid() and status in ('available','cancelled')) or public.is_admin()
  );

drop policy if exists "donations_delete" on public.donations;
create policy "donations_delete" on public.donations
  for delete using (
    (donor_id = auth.uid() and status = 'available') or public.is_admin()
  );

-- food_requests
drop policy if exists "food_requests_select" on public.food_requests;
create policy "food_requests_select" on public.food_requests
  for select using (
    receiver_id = auth.uid() or donor_id = auth.uid() or public.is_admin()
  );

drop policy if exists "food_requests_insert" on public.food_requests;
create policy "food_requests_insert" on public.food_requests
  for insert with check (receiver_id = auth.uid());

drop policy if exists "food_requests_update" on public.food_requests;
create policy "food_requests_update" on public.food_requests
  for update using (
    receiver_id = auth.uid() or donor_id = auth.uid() or public.is_admin()
  ) with check (
    receiver_id = auth.uid() or donor_id = auth.uid() or public.is_admin()
  );

-- notifications
drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- reports
drop policy if exists "reports_insert" on public.reports;
create policy "reports_insert" on public.reports
  for insert with check (reporter_id = auth.uid());

drop policy if exists "reports_select" on public.reports;
create policy "reports_select" on public.reports
  for select using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists "reports_update" on public.reports;
create policy "reports_update" on public.reports
  for update using (public.is_admin()) with check (public.is_admin());

-- admin_logs
drop policy if exists "admin_logs_select" on public.admin_logs;
create policy "admin_logs_select" on public.admin_logs
  for select using (public.is_admin());

drop policy if exists "admin_logs_insert" on public.admin_logs;
create policy "admin_logs_insert" on public.admin_logs
  for insert with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 5. RPCs (security definer; they perform the privileged state transitions)
-- -----------------------------------------------------------------------------

-- Receiver claims a donation.
create or replace function public.claim_donation(p_donation_id uuid, p_message text default null)
returns public.food_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_profile  public.profiles%rowtype;
  v_donation public.donations%rowtype;
  v_request  public.food_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found or v_profile.role <> 'receiver' or v_profile.is_suspended then
    raise exception 'not allowed';
  end if;

  select * into v_donation from public.donations where id = p_donation_id for update;
  if not found then
    raise exception 'donation not found';
  end if;
  if v_donation.status <> 'available' then
    raise exception 'donation is not available';
  end if;
  if v_donation.expires_at <= now() then
    raise exception 'donation has expired';
  end if;

  if exists (
    select 1 from public.food_requests
    where donation_id = p_donation_id
      and receiver_id = v_uid
      and status not in ('rejected','cancelled','failed')
  ) then
    raise exception 'you already have an active request for this donation';
  end if;

  insert into public.food_requests (donation_id, receiver_id, donor_id, status, message)
  values (p_donation_id, v_uid, v_donation.donor_id, 'pending', p_message)
  returning * into v_request;

  if v_donation.allocation_mode = 'single' then
    perform set_config('app.rpc', 'on', true);
    update public.donations
       set status = 'claimed', claimed_by = v_uid
     where id = p_donation_id;
  end if;

  insert into public.notifications (user_id, type, message, related_table, related_id)
  values (
    v_donation.donor_id,
    'new_request',
    'A receiver requested your donation "' || coalesce(v_donation.title, '') || '".',
    'food_requests',
    v_request.id
  );

  return v_request;
end;
$$;

-- Donor (or admin) accepts or rejects a pending request.
create or replace function public.decide_request(p_request_id uuid, p_decision text)
returns public.food_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_req   public.food_requests%rowtype;
  v_don   public.donations%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_decision not in ('accept','reject') then
    raise exception 'invalid decision';
  end if;

  select * into v_req from public.food_requests where id = p_request_id for update;
  if not found then
    raise exception 'request not found';
  end if;
  if v_req.donor_id <> v_uid and not public.is_admin() then
    raise exception 'not allowed';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'request is not pending';
  end if;

  select * into v_don from public.donations where id = v_req.donation_id for update;

  if p_decision = 'accept' then
    update public.food_requests set status = 'accepted'
     where id = p_request_id
    returning * into v_req;
  else
    update public.food_requests set status = 'rejected'
     where id = p_request_id
    returning * into v_req;

    if v_don.allocation_mode = 'single'
       and v_don.status = 'claimed'
       and v_don.claimed_by = v_req.receiver_id then
      perform set_config('app.rpc', 'on', true);
      update public.donations
         set status = 'available', claimed_by = null
       where id = v_don.id;
    end if;
  end if;

  insert into public.notifications (user_id, type, message, related_table, related_id)
  values (
    v_req.receiver_id,
    'request_' || v_req.status,
    'Your food request has been ' || v_req.status || '.',
    'food_requests',
    v_req.id
  );

  return v_req;
end;
$$;

-- Donor schedules pickup for an accepted request.
create or replace function public.schedule_pickup(p_request_id uuid, p_scheduled_at timestamptz)
returns public.food_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.food_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_scheduled_at is null then
    raise exception 'pickup time is required';
  end if;

  select * into v_req from public.food_requests where id = p_request_id for update;
  if not found then
    raise exception 'request not found';
  end if;
  if v_req.donor_id <> v_uid then
    raise exception 'not allowed';
  end if;
  if v_req.status <> 'accepted' then
    raise exception 'request is not accepted';
  end if;

  update public.food_requests
     set status = 'pickup_scheduled', pickup_scheduled_at = p_scheduled_at
   where id = p_request_id
  returning * into v_req;

  perform set_config('app.rpc', 'on', true);
  update public.donations set status = 'pickup_scheduled'
   where id = v_req.donation_id;

  insert into public.notifications (user_id, type, message, related_table, related_id)
  values (
    v_req.receiver_id,
    'pickup_scheduled',
    'A pickup has been scheduled for your request.',
    'food_requests',
    v_req.id
  );

  return v_req;
end;
$$;

-- Receiver confirms the food was collected.
create or replace function public.mark_collected(p_request_id uuid, p_quantity numeric)
returns public.food_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.food_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be greater than 0';
  end if;

  select * into v_req from public.food_requests where id = p_request_id for update;
  if not found then
    raise exception 'request not found';
  end if;
  if v_req.receiver_id <> v_uid then
    raise exception 'not allowed';
  end if;
  if v_req.status <> 'pickup_scheduled' then
    raise exception 'pickup is not scheduled';
  end if;

  update public.food_requests
     set status = 'collected', quantity_collected = p_quantity, collected_at = now()
   where id = p_request_id
  returning * into v_req;

  insert into public.notifications (user_id, type, message, related_table, related_id)
  values (
    v_req.donor_id,
    'collected',
    'The receiver has confirmed collection of your donation.',
    'food_requests',
    v_req.id
  );

  return v_req;
end;
$$;

-- Donor confirms completion after collection.
create or replace function public.confirm_completed(p_request_id uuid)
returns public.food_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.food_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_req from public.food_requests where id = p_request_id for update;
  if not found then
    raise exception 'request not found';
  end if;
  if v_req.donor_id <> v_uid then
    raise exception 'not allowed';
  end if;
  if v_req.status <> 'collected' then
    raise exception 'request is not collected';
  end if;

  update public.food_requests
     set status = 'completed', completed_at = now()
   where id = p_request_id
  returning * into v_req;

  perform set_config('app.rpc', 'on', true);
  update public.donations set status = 'completed'
   where id = v_req.donation_id;

  insert into public.notifications (user_id, type, message, related_table, related_id)
  values (
    v_req.receiver_id,
    'completed',
    'The donor has confirmed this pickup is completed.',
    'food_requests',
    v_req.id
  );

  return v_req;
end;
$$;

-- Public aggregate stats (real aggregates only).
create or replace function public.public_impact_stats()
returns json
language sql
security definer
stable
set search_path = public
as $$
  select json_build_object(
    'completed_donations',
      (select count(*) from public.food_requests where status = 'completed'),
    'quantity_collected',
      (select coalesce(sum(quantity_collected), 0) from public.food_requests where status = 'completed'),
    'estimated_people_served',
      (select coalesce(sum(estimated_people), 0) from public.donations where status = 'completed'),
    'donor_count',
      (select count(*) from public.profiles where role = 'donor'),
    'receiver_count',
      (select count(*) from public.profiles where role = 'receiver')
  );
$$;

-- -----------------------------------------------------------------------------
-- 6. Grants for RPCs
-- -----------------------------------------------------------------------------

revoke all on function public.claim_donation(uuid, text)         from public, anon;
revoke all on function public.decide_request(uuid, text)         from public, anon;
revoke all on function public.schedule_pickup(uuid, timestamptz) from public, anon;
revoke all on function public.mark_collected(uuid, numeric)      from public, anon;
revoke all on function public.confirm_completed(uuid)            from public, anon;

grant execute on function public.claim_donation(uuid, text)         to authenticated;
grant execute on function public.decide_request(uuid, text)         to authenticated;
grant execute on function public.schedule_pickup(uuid, timestamptz) to authenticated;
grant execute on function public.mark_collected(uuid, numeric)      to authenticated;
grant execute on function public.confirm_completed(uuid)            to authenticated;

revoke all on function public.public_impact_stats() from public;
grant execute on function public.public_impact_stats() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. Realtime publication (guarded so reruns do not fail)
-- -----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'donations') then
    alter publication supabase_realtime add table public.donations;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'food_requests') then
    alter publication supabase_realtime add table public.food_requests;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Storage buckets and policies
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('donation-images', 'donation-images', true),
  ('profile-images',  'profile-images',  false)
on conflict do nothing;

drop policy if exists "donation_images_public_select" on storage.objects;
create policy "donation_images_public_select" on storage.objects
  for select using (bucket_id = 'donation-images');

drop policy if exists "owner_objects_insert" on storage.objects;
create policy "owner_objects_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('donation-images','profile-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner_objects_update" on storage.objects;
create policy "owner_objects_update" on storage.objects
  for update to authenticated using (
    bucket_id in ('donation-images','profile-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id in ('donation-images','profile-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner_objects_delete" on storage.objects;
create policy "owner_objects_delete" on storage.objects
  for delete to authenticated using (
    bucket_id in ('donation-images','profile-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- -----------------------------------------------------------------------------
-- 9. First admin (run manually in the SQL Editor only, after signing up)
-- -----------------------------------------------------------------------------
-- update profiles set role = 'admin' where id = '<uuid>';
