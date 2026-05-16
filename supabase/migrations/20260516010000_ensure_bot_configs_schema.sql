-- Ensure bot_configs table has all required columns
-- This table was originally created outside the migration system.
-- This migration ensures the schema matches what the application code expects.

create table if not exists public.bot_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  telegram_bot_token text not null,
  webhook_secret text not null,
  webhook_secret_sha256 text,
  is_active boolean not null default true,
  confirmation_threshold integer not null default 500,
  llm_api_key text,
  llm_provider text,
  allowed_telegram_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add any missing columns if table already exists
do $$
begin
  if to_regclass('public.bot_configs') is not null then
    begin
      alter table public.bot_configs add column if not exists telegram_bot_token text;
      alter table public.bot_configs add column if not exists webhook_secret text;
      alter table public.bot_configs add column if not exists webhook_secret_sha256 text;
      alter table public.bot_configs add column if not exists is_active boolean not null default true;
      alter table public.bot_configs add column if not exists confirmation_threshold integer not null default 500;
      alter table public.bot_configs add column if not exists llm_api_key text;
      alter table public.bot_configs add column if not exists llm_provider text;
      alter table public.bot_configs add column if not exists allowed_telegram_ids jsonb not null default '[]'::jsonb;
    exception when others then
      raise notice 'Could not add columns to bot_configs: %', SQLERRM;
    end;
  end if;
end $$;

-- Ensure indexes exist
create unique index if not exists bot_configs_tenant_id_uidx
  on public.bot_configs (tenant_id);

create unique index if not exists bot_configs_webhook_secret_sha256_uidx
  on public.bot_configs (webhook_secret_sha256)
  where webhook_secret_sha256 is not null;

-- Ensure RLS
alter table if exists public.bot_configs enable row level security;

-- Drop existing policies first to avoid conflicts
drop policy if exists "service role full access" on public.bot_configs;
create policy "service role full access"
  on public.bot_configs
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "authenticated bot configs select by membership" on public.bot_configs;
create policy "authenticated bot configs select by membership"
  on public.bot_configs
  for select
  to authenticated
  using (
    public.is_active_member(auth.uid(), tenant_id)
  );

drop policy if exists "authenticated bot configs insert by role" on public.bot_configs;
create policy "authenticated bot configs insert by role"
  on public.bot_configs
  for insert
  to authenticated
  with check (
    public.get_user_role_in_tenant(auth.uid(), tenant_id) in ('owner', 'admin')
  );

drop policy if exists "authenticated bot configs update by role" on public.bot_configs;
create policy "authenticated bot configs update by role"
  on public.bot_configs
  for update
  to authenticated
  using (
    public.get_user_role_in_tenant(auth.uid(), tenant_id) in ('owner', 'admin')
  )
  with check (
    public.get_user_role_in_tenant(auth.uid(), tenant_id) in ('owner', 'admin')
  );

-- Ensure updated_at trigger
drop trigger if exists set_bot_configs_updated_at on public.bot_configs;
create trigger set_bot_configs_updated_at
  before update on public.bot_configs
  for each row
  execute function public.set_row_updated_at();
