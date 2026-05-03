create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_not_blank check (btrim(action) <> ''),
  constraint audit_logs_resource_type_not_blank check (btrim(resource_type) <> '')
);

create index if not exists audit_logs_tenant_id_created_at_idx
  on public.audit_logs (tenant_id, created_at desc);

create index if not exists audit_logs_user_id_created_at_idx
  on public.audit_logs (user_id, created_at desc);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  limits jsonb not null default '{}'::jsonb,
  price_monthly numeric(10,2),
  price_yearly numeric(10,2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plans_name_not_blank check (btrim(name) <> ''),
  constraint plans_slug_not_blank check (btrim(slug) <> '')
);

create unique index if not exists plans_slug_unique_idx
  on public.plans (lower(slug));

drop trigger if exists set_plans_updated_at on public.plans;
create trigger set_plans_updated_at
before update on public.plans
for each row
execute function public.set_row_updated_at();

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status text not null default 'active',
  provider text not null default 'internal',
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_status_check check (status in ('trialing', 'active', 'past_due', 'canceled', 'inactive')),
  constraint subscriptions_provider_not_blank check (btrim(provider) <> '')
);

create unique index if not exists subscriptions_tenant_id_unique_idx
  on public.subscriptions (tenant_id);

create index if not exists subscriptions_plan_id_idx
  on public.subscriptions (plan_id);

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row
execute function public.set_row_updated_at();

insert into public.plans (name, slug, limits, price_monthly, price_yearly, active)
values
  ('Free', 'free', '{"max_users": 5, "max_clients": 100, "max_tasks": 500}'::jsonb, 0, 0, true),
  ('Growth', 'growth', '{"max_users": 25, "max_clients": 1000, "max_tasks": 5000}'::jsonb, 99, 990, true)
on conflict (lower(slug))
do update
   set name = excluded.name,
       limits = excluded.limits,
       price_monthly = excluded.price_monthly,
       price_yearly = excluded.price_yearly,
       active = excluded.active,
       updated_at = now();

alter table if exists public.audit_logs enable row level security;
alter table if exists public.plans enable row level security;
alter table if exists public.subscriptions enable row level security;

create or replace function public.ensure_default_subscription(
  p_tenant_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_subscription_id uuid;
begin
  select id
    into v_plan_id
    from public.plans
   where lower(slug) = 'free'
   limit 1;

  if v_plan_id is null then
    raise exception 'free_plan_missing';
  end if;

  insert into public.subscriptions (
    tenant_id,
    plan_id,
    status,
    provider,
    current_period_start,
    current_period_end
  )
  values (
    p_tenant_id,
    v_plan_id,
    'active',
    'internal',
    now(),
    null
  )
  on conflict (tenant_id)
  do update
     set plan_id = excluded.plan_id,
         status = excluded.status,
         provider = excluded.provider,
         updated_at = now()
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;

create or replace function public.get_tenant_effective_limits(
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limits jsonb;
begin
  select coalesce(plans.limits, '{}'::jsonb)
    into v_limits
    from public.subscriptions
    join public.plans on plans.id = subscriptions.plan_id
   where subscriptions.tenant_id = p_tenant_id
     and subscriptions.status in ('trialing', 'active', 'past_due')
   order by subscriptions.updated_at desc
   limit 1;

  if v_limits is null then
    select coalesce(limits, '{}'::jsonb)
      into v_limits
      from public.plans
     where lower(slug) = 'free'
     limit 1;
  end if;

  return coalesce(v_limits, '{}'::jsonb);
end;
$$;

create or replace function public.count_reserved_user_slots(
  p_tenant_id uuid
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      select count(*)
        from public.memberships
       where tenant_id = p_tenant_id
         and status = 'active'
    )
    +
    (
      select count(*)
        from public.invitations
       where tenant_id = p_tenant_id
         and status = 'pending'
         and expires_at > now()
    );
$$;

create or replace function public.create_invitation(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_email text,
  p_role text
)
returns public.invitations
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_token text;
  v_invitation public.invitations%rowtype;
  v_limits jsonb;
  v_max_users integer;
  v_reserved_slots bigint;
begin
  if not public.can_manage_tenant_members(p_actor_user_id, p_tenant_id) then
    raise exception 'member_management_forbidden';
  end if;

  v_email := lower(btrim(coalesce(p_email, '')));
  if v_email = '' then
    raise exception 'invite_email_required';
  end if;

  if coalesce(p_role, '') not in ('admin', 'member', 'viewer') then
    raise exception 'invite_role_invalid';
  end if;

  perform public.expire_stale_invitations(p_tenant_id);

  perform 1
    from public.memberships
    join auth.users on users.id = memberships.user_id
   where memberships.tenant_id = p_tenant_id
     and memberships.status = 'active'
     and lower(btrim(users.email)) = v_email;

  if found then
    raise exception 'invite_email_already_member';
  end if;

  select public.get_tenant_effective_limits(p_tenant_id)
    into v_limits;

  v_max_users := nullif(coalesce(v_limits ->> 'max_users', ''), '')::integer;

  if v_max_users is not null then
    select public.count_reserved_user_slots(p_tenant_id)
      into v_reserved_slots;

    perform 1
      from public.invitations
     where tenant_id = p_tenant_id
       and lower(email) = v_email
       and status = 'pending';

    if not found and v_reserved_slots + 1 > v_max_users then
      raise exception 'invite_user_limit_reached';
    end if;
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  update public.invitations
     set role = p_role,
         invited_by = p_actor_user_id,
         token = v_token,
         status = 'pending',
         expires_at = now() + interval '7 days',
         accepted_at = null,
         accepted_by = null,
         updated_at = now()
   where tenant_id = p_tenant_id
     and lower(email) = v_email
     and status = 'pending'
  returning * into v_invitation;

  if v_invitation.id is null then
    insert into public.invitations (tenant_id, email, role, invited_by, token, status, expires_at)
    values (p_tenant_id, v_email, p_role, p_actor_user_id, v_token, 'pending', now() + interval '7 days')
    returning * into v_invitation;
  end if;

  return v_invitation;
end;
$$;

create or replace function public.create_tenant_with_owner(
  p_owner_user_id uuid,
  p_name text default 'Workspace Migrado',
  p_slug text default 'workspace-migrado'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_tenant_id uuid;
  v_existing_owner uuid;
begin
  if p_owner_user_id is null then
    raise exception 'owner_user_id is required';
  end if;

  perform 1
    from auth.users
   where id = p_owner_user_id;

  if not found then
    raise exception 'auth.users entry not found for owner_user_id %', p_owner_user_id;
  end if;

  select id, owner_user_id
    into v_tenant_id, v_existing_owner
    from public.tenants
   where lower(slug) = lower(p_slug)
   limit 1;

  if v_tenant_id is null then
    insert into public.tenants (name, slug, owner_user_id)
    values (p_name, p_slug, p_owner_user_id)
    returning id into v_tenant_id;
  elsif v_existing_owner <> p_owner_user_id then
    raise exception 'tenant slug % already exists with a different owner_user_id', p_slug;
  end if;

  insert into public.memberships (tenant_id, user_id, role, status)
  values (v_tenant_id, p_owner_user_id, 'owner', 'active')
  on conflict (tenant_id, user_id)
  do update
     set role = 'owner',
         status = 'active',
         updated_at = now();

  perform public.ensure_default_subscription(v_tenant_id);

  return v_tenant_id;
end;
$$;

revoke all on function public.ensure_default_subscription(uuid) from public;
revoke all on function public.get_tenant_effective_limits(uuid) from public;
revoke all on function public.count_reserved_user_slots(uuid) from public;
grant execute on function public.ensure_default_subscription(uuid) to authenticated, service_role;
grant execute on function public.get_tenant_effective_limits(uuid) to authenticated, service_role;
grant execute on function public.count_reserved_user_slots(uuid) to authenticated, service_role;

drop policy if exists "authenticated audit logs select by admin role" on public.audit_logs;
create policy "authenticated audit logs select by admin role"
  on public.audit_logs
  for select
  to authenticated
  using (
    tenant_id is not null
    and public.get_user_role_in_tenant(auth.uid(), tenant_id) in ('owner', 'admin')
  );

drop policy if exists "service role audit logs full access" on public.audit_logs;
create policy "service role audit logs full access"
  on public.audit_logs
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "authenticated plans select active" on public.plans;
create policy "authenticated plans select active"
  on public.plans
  for select
  to authenticated
  using (active = true);

drop policy if exists "service role plans full access" on public.plans;
create policy "service role plans full access"
  on public.plans
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "authenticated subscriptions select by admin role" on public.subscriptions;
create policy "authenticated subscriptions select by admin role"
  on public.subscriptions
  for select
  to authenticated
  using (
    public.get_user_role_in_tenant(auth.uid(), tenant_id) in ('owner', 'admin')
  );

drop policy if exists "service role subscriptions full access" on public.subscriptions;
create policy "service role subscriptions full access"
  on public.subscriptions
  for all
  to service_role
  using (true)
  with check (true);
