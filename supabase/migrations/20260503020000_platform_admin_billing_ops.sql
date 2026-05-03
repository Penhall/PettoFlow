create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  role text not null default 'admin',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_admins_email_not_blank check (btrim(email) <> ''),
  constraint platform_admins_role_check check (role in ('admin'))
);

create unique index if not exists platform_admins_email_unique_idx
  on public.platform_admins (lower(email));

create unique index if not exists platform_admins_user_id_unique_idx
  on public.platform_admins (user_id)
  where user_id is not null;

drop trigger if exists set_platform_admins_updated_at on public.platform_admins;
create trigger set_platform_admins_updated_at
before update on public.platform_admins
for each row
execute function public.set_row_updated_at();

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  tenant_id uuid references public.tenants(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  status text not null default 'received',
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  request_id text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint billing_events_provider_not_blank check (btrim(provider) <> ''),
  constraint billing_events_event_id_not_blank check (btrim(event_id) <> ''),
  constraint billing_events_event_type_not_blank check (btrim(event_type) <> ''),
  constraint billing_events_status_check check (status in ('received', 'processed', 'failed', 'ignored'))
);

create unique index if not exists billing_events_provider_event_unique_idx
  on public.billing_events (provider, event_id);

create index if not exists billing_events_tenant_id_created_at_idx
  on public.billing_events (tenant_id, created_at desc);

create index if not exists billing_events_status_created_at_idx
  on public.billing_events (status, created_at desc);

alter table public.plans
  add column if not exists description text,
  add column if not exists display_order integer not null default 0,
  add column if not exists stripe_price_monthly_id text,
  add column if not exists stripe_price_yearly_id text;

create index if not exists plans_display_order_idx
  on public.plans (display_order, lower(name));

create unique index if not exists plans_stripe_price_monthly_unique_idx
  on public.plans (stripe_price_monthly_id)
  where stripe_price_monthly_id is not null;

create unique index if not exists plans_stripe_price_yearly_unique_idx
  on public.plans (stripe_price_yearly_id)
  where stripe_price_yearly_id is not null;

alter table public.subscriptions
  add column if not exists billing_interval text not null default 'monthly',
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists checkout_session_id text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
      from information_schema.table_constraints
     where table_schema = 'public'
       and table_name = 'subscriptions'
       and constraint_name = 'subscriptions_billing_interval_check'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_billing_interval_check
      check (billing_interval in ('monthly', 'yearly'));
  end if;
end;
$$;

create unique index if not exists subscriptions_checkout_session_id_unique_idx
  on public.subscriptions (checkout_session_id)
  where checkout_session_id is not null;

create index if not exists subscriptions_provider_customer_id_idx
  on public.subscriptions (provider_customer_id)
  where provider_customer_id is not null;

create index if not exists subscriptions_provider_subscription_id_idx
  on public.subscriptions (provider_subscription_id)
  where provider_subscription_id is not null;

create or replace function public.is_current_user_platform_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_user_id is null and v_email = '' then
    return false;
  end if;

  return exists (
    select 1
      from public.platform_admins
     where active = true
       and (
         (user_id is not null and user_id = v_user_id)
         or (v_email <> '' and lower(email) = v_email)
       )
  );
end;
$$;

create or replace function public.can_manage_tenant_billing(
  p_user_id uuid,
  p_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_user_role_in_tenant(p_user_id, p_tenant_id) in ('owner', 'admin');
$$;

create or replace function public.get_tenant_usage_snapshot(
  p_tenant_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'active_members', (
      select count(*)
        from public.memberships
       where tenant_id = p_tenant_id
         and status = 'active'
    ),
    'pending_invitations', (
      select count(*)
        from public.invitations
       where tenant_id = p_tenant_id
         and status = 'pending'
         and expires_at > now()
    ),
    'clients', (
      select count(*)
        from public.clients
       where tenant_id = p_tenant_id
    ),
    'tasks', (
      select count(*)
        from public.tasks
       where tenant_id = p_tenant_id
         and archived_at is null
    ),
    'activities', (
      select count(*)
        from public.activities
       where tenant_id = p_tenant_id
    ),
    'transactions', (
      select count(*)
        from public.transactions
       where tenant_id = p_tenant_id
    ),
    'receivables', (
      select count(*)
        from public.receivables
       where tenant_id = p_tenant_id
    )
  );
$$;

update public.plans
   set description = case lower(slug)
       when 'free' then 'Plano inicial para equipes pequenas em validacao.'
       when 'growth' then 'Plano para equipes em operacao com colaboracao e escala controlada.'
       else description
     end,
       display_order = case lower(slug)
         when 'free' then 10
         when 'growth' then 20
         else display_order
       end,
       limits = case lower(slug)
         when 'free' then jsonb_set(
           jsonb_set(
             jsonb_set(coalesce(limits, '{}'::jsonb), '{max_users}', to_jsonb(5), true),
             '{max_activities}', to_jsonb(500), true
           ),
           '{max_transactions}', to_jsonb(1000), true
         )
         when 'growth' then jsonb_set(
           jsonb_set(
             jsonb_set(coalesce(limits, '{}'::jsonb), '{max_users}', to_jsonb(25), true),
             '{max_activities}', to_jsonb(5000), true
           ),
           '{max_transactions}', to_jsonb(15000), true
         )
         else limits
       end,
       updated_at = now();

alter table if exists public.platform_admins enable row level security;
alter table if exists public.billing_events enable row level security;

revoke all on function public.is_current_user_platform_admin() from public;
revoke all on function public.can_manage_tenant_billing(uuid, uuid) from public;
revoke all on function public.get_tenant_usage_snapshot(uuid) from public;
grant execute on function public.is_current_user_platform_admin() to authenticated, service_role;
grant execute on function public.can_manage_tenant_billing(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_tenant_usage_snapshot(uuid) to authenticated, service_role;

drop policy if exists "authenticated platform admins self select" on public.platform_admins;
create policy "authenticated platform admins self select"
  on public.platform_admins
  for select
  to authenticated
  using (
    active = true
    and (
      user_id = auth.uid()
      or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "service role platform admins full access" on public.platform_admins;
create policy "service role platform admins full access"
  on public.platform_admins
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "authenticated billing events select by admin role" on public.billing_events;
create policy "authenticated billing events select by admin role"
  on public.billing_events
  for select
  to authenticated
  using (
    public.is_current_user_platform_admin()
    or (
      tenant_id is not null
      and public.get_user_role_in_tenant(auth.uid(), tenant_id) in ('owner', 'admin')
    )
  );

drop policy if exists "service role billing events full access" on public.billing_events;
create policy "service role billing events full access"
  on public.billing_events
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "authenticated audit logs select by admin role" on public.audit_logs;
create policy "authenticated audit logs select by admin role"
  on public.audit_logs
  for select
  to authenticated
  using (
    public.is_current_user_platform_admin()
    or (
      tenant_id is not null
      and public.get_user_role_in_tenant(auth.uid(), tenant_id) in ('owner', 'admin')
    )
  );

drop policy if exists "authenticated subscriptions select by admin role" on public.subscriptions;
create policy "authenticated subscriptions select by admin role"
  on public.subscriptions
  for select
  to authenticated
  using (
    public.is_current_user_platform_admin()
    or public.get_user_role_in_tenant(auth.uid(), tenant_id) in ('owner', 'admin')
  );
