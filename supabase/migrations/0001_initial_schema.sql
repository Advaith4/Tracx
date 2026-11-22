-- Tracx: Initial database schema & Row Level Security policies
-- Covers Tech Doc §8 and PRD §4-§25 (user-owned health tracking records)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared trigger helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  locale text not null default 'en',
  date_of_birth date,
  pregnancy_week integer check (pregnancy_week is null or (pregnancy_week between 1 and 45)),
  expected_due_date date,
  provider_name text,
  provider_contact text,
  personal_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using ((select auth.uid()) = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "profiles_delete_own"
  on public.profiles for delete
  using ((select auth.uid()) = id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'display_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. tracking_configs
-- ---------------------------------------------------------------------------

create table if not exists public.tracking_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_type text not null check (metric_type in ('glucose', 'blood_pressure', 'weight', 'custom')),
  custom_label text,
  enabled boolean not null default true,
  schedule jsonb not null default '{}'::jsonb,
  provider_targets jsonb,
  unit text not null,
  show_on_dashboard boolean not null default true,
  include_in_reports boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_tracking_configs_user
  on public.tracking_configs (user_id);

alter table public.tracking_configs enable row level security;

create policy "tracking_configs_select_own"
  on public.tracking_configs for select
  using ((select auth.uid()) = user_id);

create policy "tracking_configs_insert_own"
  on public.tracking_configs for insert
  with check ((select auth.uid()) = user_id);

create policy "tracking_configs_update_own"
  on public.tracking_configs for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "tracking_configs_delete_own"
  on public.tracking_configs for delete
  using ((select auth.uid()) = user_id);

create trigger tracking_configs_set_updated_at
  before update on public.tracking_configs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. glucose_records
-- ---------------------------------------------------------------------------

create table if not exists public.glucose_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  value numeric(6,2) not null check (value > 0),
  unit text not null check (unit in ('mg/dL', 'mmol/L')),
  measured_at timestamptz not null,
  entered_at timestamptz not null default timezone('utc', now()),
  meal_context text not null check (meal_context in ('fasting', 'breakfast', 'lunch', 'dinner', 'snack', 'unknown')),
  timing text not null check (timing in ('before', 'after', 'unknown')),
  elapsed_minutes integer check (elapsed_minutes is null or elapsed_minutes >= 0),
  notes text,
  source text not null default 'manual' check (source in ('manual', 'voice', 'import')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_glucose_records_user_measured
  on public.glucose_records (user_id, measured_at desc);

alter table public.glucose_records enable row level security;

create policy "glucose_records_select_own"
  on public.glucose_records for select
  using ((select auth.uid()) = user_id);

create policy "glucose_records_insert_own"
  on public.glucose_records for insert
  with check ((select auth.uid()) = user_id);

create policy "glucose_records_update_own"
  on public.glucose_records for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "glucose_records_delete_own"
  on public.glucose_records for delete
  using ((select auth.uid()) = user_id);

create trigger glucose_records_set_updated_at
  before update on public.glucose_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. blood_pressure_records
-- ---------------------------------------------------------------------------

create table if not exists public.blood_pressure_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  systolic integer not null check (systolic between 40 and 300),
  diastolic integer not null check (diastolic between 20 and 200),
  pulse integer check (pulse is null or pulse between 20 and 250),
  measured_at timestamptz not null,
  entered_at timestamptz not null default timezone('utc', now()),
  notes text,
  source text not null default 'manual' check (source in ('manual', 'voice', 'import')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_blood_pressure_records_user_measured
  on public.blood_pressure_records (user_id, measured_at desc);

alter table public.blood_pressure_records enable row level security;

create policy "blood_pressure_records_select_own"
  on public.blood_pressure_records for select
  using ((select auth.uid()) = user_id);

create policy "blood_pressure_records_insert_own"
  on public.blood_pressure_records for insert
  with check ((select auth.uid()) = user_id);

create policy "blood_pressure_records_update_own"
  on public.blood_pressure_records for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "blood_pressure_records_delete_own"
  on public.blood_pressure_records for delete
  using ((select auth.uid()) = user_id);

create trigger blood_pressure_records_set_updated_at
  before update on public.blood_pressure_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. weight_records
-- ---------------------------------------------------------------------------

create table if not exists public.weight_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  value numeric(6,2) not null check (value > 0),
  unit text not null check (unit in ('kg', 'lb')),
  measured_at timestamptz not null,
  entered_at timestamptz not null default timezone('utc', now()),
  notes text,
  source text not null default 'manual' check (source in ('manual', 'voice', 'import')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_weight_records_user_measured
  on public.weight_records (user_id, measured_at desc);

alter table public.weight_records enable row level security;

create policy "weight_records_select_own"
  on public.weight_records for select
  using ((select auth.uid()) = user_id);

create policy "weight_records_insert_own"
  on public.weight_records for insert
  with check ((select auth.uid()) = user_id);

create policy "weight_records_update_own"
  on public.weight_records for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "weight_records_delete_own"
  on public.weight_records for delete
  using ((select auth.uid()) = user_id);

create trigger weight_records_set_updated_at
  before update on public.weight_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. custom_metric_records
-- ---------------------------------------------------------------------------

create table if not exists public.custom_metric_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_config_id uuid not null references public.tracking_configs(id) on delete cascade,
  value_numeric numeric,
  value_text text,
  unit text,
  measured_at timestamptz not null,
  entered_at timestamptz not null default timezone('utc', now()),
  notes text,
  source text not null default 'manual' check (source in ('manual', 'voice', 'import')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (value_numeric is not null or value_text is not null)
);

create index if not exists idx_custom_metric_records_user_measured
  on public.custom_metric_records (user_id, measured_at desc);

alter table public.custom_metric_records enable row level security;

create policy "custom_metric_records_select_own"
  on public.custom_metric_records for select
  using ((select auth.uid()) = user_id);

create policy "custom_metric_records_insert_own"
  on public.custom_metric_records for insert
  with check ((select auth.uid()) = user_id);

create policy "custom_metric_records_update_own"
  on public.custom_metric_records for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "custom_metric_records_delete_own"
  on public.custom_metric_records for delete
  using ((select auth.uid()) = user_id);

create trigger custom_metric_records_set_updated_at
  before update on public.custom_metric_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. measurement_skips & 8. daily_notes
-- ---------------------------------------------------------------------------

create table if not exists public.measurement_skips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_type text not null,
  tracking_config_id uuid references public.tracking_configs(id) on delete set null,
  scheduled_date date not null,
  context_label text,
  reason text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_measurement_skips_user_date
  on public.measurement_skips (user_id, scheduled_date desc);

alter table public.measurement_skips enable row level security;

create policy "measurement_skips_select_own"
  on public.measurement_skips for select
  using ((select auth.uid()) = user_id);

create policy "measurement_skips_insert_own"
  on public.measurement_skips for insert
  with check ((select auth.uid()) = user_id);

create policy "measurement_skips_update_own"
  on public.measurement_skips for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "measurement_skips_delete_own"
  on public.measurement_skips for delete
  using ((select auth.uid()) = user_id);

create table if not exists public.daily_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_date date not null,
  content text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, note_date)
);

alter table public.daily_notes enable row level security;

create policy "daily_notes_select_own"
  on public.daily_notes for select
  using ((select auth.uid()) = user_id);

create policy "daily_notes_insert_own"
  on public.daily_notes for insert
  with check ((select auth.uid()) = user_id);

create policy "daily_notes_update_own"
  on public.daily_notes for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "daily_notes_delete_own"
  on public.daily_notes for delete
  using ((select auth.uid()) = user_id);

create trigger daily_notes_set_updated_at
  before update on public.daily_notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. reminders & 10. notification_logs & 11. push_subscriptions
-- ---------------------------------------------------------------------------

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_type text not null,
  label text not null,
  scheduled_time time not null,
  timezone text not null default 'UTC',
  days_of_week integer[] not null default '{0,1,2,3,4,5,6}',
  channel text not null default 'in_app' check (channel in ('in_app', 'push', 'email')),
  enabled boolean not null default true,
  follow_up_minutes integer check (follow_up_minutes is null or follow_up_minutes > 0),
  snooze_minutes integer not null default 15 check (snooze_minutes > 0),
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_reminders_user
  on public.reminders (user_id);

alter table public.reminders enable row level security;

create policy "reminders_select_own"
  on public.reminders for select
  using ((select auth.uid()) = user_id);

create policy "reminders_insert_own"
  on public.reminders for insert
  with check ((select auth.uid()) = user_id);

create policy "reminders_update_own"
  on public.reminders for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "reminders_delete_own"
  on public.reminders for delete
  using ((select auth.uid()) = user_id);

create trigger reminders_set_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_id uuid references public.reminders(id) on delete set null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  read_at timestamptz,
  channel text not null check (channel in ('in_app', 'push', 'email')),
  status text not null check (status in ('pending', 'sent', 'failed', 'skipped')),
  error_message text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_notification_logs_user_scheduled
  on public.notification_logs (user_id, scheduled_for desc);

alter table public.notification_logs enable row level security;

create policy "notification_logs_select_own"
  on public.notification_logs for select
  using ((select auth.uid()) = user_id);

create policy "notification_logs_insert_own"
  on public.notification_logs for insert
  with check ((select auth.uid()) = user_id);

create policy "notification_logs_update_own"
  on public.notification_logs for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "notification_logs_delete_own"
  on public.notification_logs for delete
  using ((select auth.uid()) = user_id);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  device_label text,
  created_at timestamptz not null default timezone('utc', now()),
  last_used_at timestamptz,
  revoked_at timestamptz,
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  using ((select auth.uid()) = user_id);

create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  with check ((select auth.uid()) = user_id);

create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 12. weekly_reports
-- ---------------------------------------------------------------------------

create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  statistics jsonb not null default '{}'::jsonb,
  summary text,
  report_data jsonb not null default '{}'::jsonb,
  file_path text,
  generated_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'complete', 'failed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_weekly_reports_user_period
  on public.weekly_reports (user_id, period_start desc);

alter table public.weekly_reports enable row level security;

create policy "weekly_reports_select_own"
  on public.weekly_reports for select
  using ((select auth.uid()) = user_id);

create policy "weekly_reports_insert_own"
  on public.weekly_reports for insert
  with check ((select auth.uid()) = user_id);

create policy "weekly_reports_update_own"
  on public.weekly_reports for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "weekly_reports_delete_own"
  on public.weekly_reports for delete
  using ((select auth.uid()) = user_id);

create trigger weekly_reports_set_updated_at
  before update on public.weekly_reports
  for each row execute function public.set_updated_at();
