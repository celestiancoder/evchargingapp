-- Enable the btree_gist extension to support overlap exclusion constraints
create extension if not exists btree_gist;

-- 1. VEHICLES TABLE 
create table public.vehicles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  license_plate text not null,
  make_model text not null,
  battery_capacity_mah numeric not null default 2200,
  created_at timestamptz default now() not null
);

alter table public.vehicles enable row level security;
create policy "Users can manage their own vehicles" on public.vehicles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. SLOTS TABLE 
create table public.slots (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  status text default 'available' check (status in ('available', 'occupied', 'maintenance')),
  max_output_amps numeric not null default 2.5,
  created_at timestamptz default now() not null
);

alter table public.slots enable row level security;
create policy "Anyone can view slots" on public.slots for select using (true);

-- 3. BOOKINGS TABLE
create table public.bookings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  vehicle_id uuid references public.vehicles(id) on delete cascade not null,
  slot_id uuid references public.slots(id) on delete cascade not null,
  booking_type text not null check (booking_type in ('parking', 'charging')),
  status text default 'reserved' check (status in ('reserved', 'active', 'completed', 'cancelled')),
  target_soc numeric constraint target_soc_range check (target_soc is null or (target_soc between 0 and 100)), 
  
  start_time timestamptz not null, 
  end_time timestamptz not null, 
  
  charge_start_time timestamptz,
  charge_end_time timestamptz,

  total_cost numeric not null default 0,
  
  created_at timestamptz default now() not null,
  
  constraint end_after_start check (end_time > start_time),
  constraint charge_end_after_start check (
    (charge_start_time is null and charge_end_time is null) or 
    (charge_end_time > charge_start_time)
  ),
  
  constraint no_overlapping_bookings exclude using gist (
    slot_id with =,
    tstzrange(start_time, end_time) with &&
  ) where (status in ('reserved', 'active'))
);

alter table public.bookings enable row level security;
create policy "Users can view and manage their own bookings" on public.bookings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. TELEMETRY TABLE 
create table public.telemetry (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid references public.bookings(id) on delete cascade not null,
  voltage numeric not null,
  current numeric not null,
  current_soc numeric not null constraint current_soc_range check (current_soc between 0 and 100), 
  recorded_at timestamptz default now() not null
);

alter table public.telemetry enable row level security;
create policy "Users can view their own telemetry" on public.telemetry for select using (booking_id in (select id from public.bookings where user_id = auth.uid()));

create index idx_bookings_user_id on public.bookings(user_id);
create index idx_bookings_slot_id on public.bookings(slot_id);
create index idx_telemetry_booking_id on public.telemetry(booking_id);

grant all on public.vehicles to service_role;
grant all on public.slots to service_role;
grant all on public.bookings to service_role;
grant all on public.telemetry to service_role;