create table if not exists public.tenant_onboarding_state (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  current_onboarding_version text not null,
  completed_onboarding_version text,
  last_seen_onboarding_version text,
  experience_level text not null default 'new',
  tour_state jsonb not null default '{}'::jsonb,
  checklist_state jsonb not null default '{}'::jsonb,
  tutorial_state jsonb not null default '{}'::jsonb,
  dismiss_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_onboarding_state_experience_level_check
    check (experience_level in ('new', 'learning', 'operational', 'advanced', 'power_user')),
  constraint tenant_onboarding_state_unique_tenant_user unique (tenant_id, user_id)
);

create index if not exists tenant_onboarding_state_tenant_user_idx
  on public.tenant_onboarding_state (tenant_id, user_id);

drop trigger if exists set_tenant_onboarding_state_updated_at on public.tenant_onboarding_state;
create trigger set_tenant_onboarding_state_updated_at
before update on public.tenant_onboarding_state
for each row
execute function public.set_row_updated_at();

create table if not exists public.tenant_onboarding_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint tenant_onboarding_events_event_name_not_blank check (btrim(event_name) <> '')
);

create index if not exists tenant_onboarding_events_tenant_created_at_idx
  on public.tenant_onboarding_events (tenant_id, created_at desc);

create index if not exists tenant_onboarding_events_user_created_at_idx
  on public.tenant_onboarding_events (user_id, created_at desc);

alter table if exists public.tenant_onboarding_state enable row level security;
alter table if exists public.tenant_onboarding_events enable row level security;

drop policy if exists "service role full access" on public.tenant_onboarding_state;
create policy "service role full access"
  on public.tenant_onboarding_state
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service role full access" on public.tenant_onboarding_events;
create policy "service role full access"
  on public.tenant_onboarding_events
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.add_origin_metadata_columns(p_table_name text)
returns void
language plpgsql
as $$
begin
  if to_regclass(format('public.%I', p_table_name)) is null then
    return;
  end if;

  execute format(
    'alter table public.%I add column if not exists origin_type text',
    p_table_name
  );
  execute format(
    'alter table public.%I add column if not exists origin_version text',
    p_table_name
  );
  execute format(
    'alter table public.%I add column if not exists seed_batch_id text',
    p_table_name
  );
  execute format(
    'alter table public.%I add column if not exists created_by_system boolean not null default false',
    p_table_name
  );
end;
$$;

select public.add_origin_metadata_columns('kanban_columns');
select public.add_origin_metadata_columns('tasks');
select public.add_origin_metadata_columns('clients');
select public.add_origin_metadata_columns('activities');
select public.add_origin_metadata_columns('accounts');
select public.add_origin_metadata_columns('transactions');

drop function if exists public.add_origin_metadata_columns(text);
