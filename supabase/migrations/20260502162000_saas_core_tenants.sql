-- supabase/migrations/20260502162000_saas_core_tenants.sql

-- Core SaaS multi-tenant tables.
-- This phase introduces the structural tenancy model only.
-- Business tables will receive tenant_id in a later migration.

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_name_not_blank check (btrim(name) <> ''),
  constraint tenants_slug_not_blank check (btrim(slug) <> ''),
  constraint tenants_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index if not exists tenants_slug_unique_idx
  on public.tenants (lower(slug));

create index if not exists tenants_owner_user_id_idx
  on public.tenants (owner_user_id);

drop trigger if exists set_tenants_updated_at on public.tenants;
create trigger set_tenants_updated_at
before update on public.tenants
for each row
execute function public.set_row_updated_at();

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memberships_role_check check (role in ('owner', 'admin', 'member', 'viewer')),
  constraint memberships_status_check check (status in ('active', 'invited', 'suspended')),
  constraint memberships_unique_tenant_user unique (tenant_id, user_id)
);

create index if not exists memberships_tenant_id_idx
  on public.memberships (tenant_id);

create index if not exists memberships_user_id_idx
  on public.memberships (user_id);

create index if not exists memberships_status_idx
  on public.memberships (status);

drop trigger if exists set_memberships_updated_at on public.memberships;
create trigger set_memberships_updated_at
before update on public.memberships
for each row
execute function public.set_row_updated_at();

create table if not exists public.tenant_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_settings_key_not_blank check (btrim(key) <> ''),
  constraint tenant_settings_unique_tenant_key unique (tenant_id, key)
);

create index if not exists tenant_settings_tenant_id_idx
  on public.tenant_settings (tenant_id);

drop trigger if exists set_tenant_settings_updated_at on public.tenant_settings;
create trigger set_tenant_settings_updated_at
before update on public.tenant_settings
for each row
execute function public.set_row_updated_at();

alter table if exists public.tenants enable row level security;
alter table if exists public.memberships enable row level security;
alter table if exists public.tenant_settings enable row level security;

drop policy if exists "service role full access" on public.tenants;
create policy "service role full access"
  on public.tenants
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service role full access" on public.memberships;
create policy "service role full access"
  on public.memberships
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service role full access" on public.tenant_settings;
create policy "service role full access"
  on public.tenant_settings
  for all
  to service_role
  using (true)
  with check (true);
