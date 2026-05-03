create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role text not null,
  invited_by uuid not null references auth.users(id) on delete restrict,
  token text not null,
  status text not null default 'pending',
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invitations_email_not_blank check (btrim(email) <> ''),
  constraint invitations_role_check check (role in ('admin', 'member', 'viewer')),
  constraint invitations_status_check check (status in ('pending', 'accepted', 'expired')),
  constraint invitations_token_not_blank check (btrim(token) <> '')
);

create unique index if not exists invitations_token_unique_idx
  on public.invitations (token);

create index if not exists invitations_tenant_id_idx
  on public.invitations (tenant_id);

create index if not exists invitations_email_idx
  on public.invitations (lower(email));

create unique index if not exists invitations_pending_email_unique_idx
  on public.invitations (tenant_id, lower(email))
  where status = 'pending';

drop trigger if exists set_invitations_updated_at on public.invitations;
create trigger set_invitations_updated_at
before update on public.invitations
for each row
execute function public.set_row_updated_at();

alter table if exists public.invitations enable row level security;

create or replace function public.can_manage_tenant_members(
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

create or replace function public.get_auth_user_email(
  p_user_id uuid
)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(btrim(users.email))
    from auth.users as users
   where users.id = p_user_id
   limit 1;
$$;

create or replace function public.count_active_owners(
  p_tenant_id uuid
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
    from public.memberships
   where memberships.tenant_id = p_tenant_id
     and memberships.role = 'owner'
     and memberships.status = 'active';
$$;

create or replace function public.expire_stale_invitations(
  p_tenant_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.invitations
     set status = 'expired',
         updated_at = now()
   where status = 'pending'
     and expires_at <= now()
     and (p_tenant_id is null or tenant_id = p_tenant_id);

  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$$;

create or replace function public.list_tenant_members(
  p_actor_user_id uuid,
  p_tenant_id uuid
)
returns table (
  id uuid,
  user_id uuid,
  email text,
  role text,
  status text,
  is_current_user boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.can_manage_tenant_members(p_actor_user_id, p_tenant_id) then
    raise exception 'member_management_forbidden';
  end if;

  return query
  select
    memberships.id,
    memberships.user_id,
    lower(btrim(users.email)) as email,
    memberships.role,
    memberships.status,
    memberships.user_id = p_actor_user_id as is_current_user,
    memberships.created_at,
    memberships.updated_at
  from public.memberships
  join auth.users as users
    on users.id = memberships.user_id
  where memberships.tenant_id = p_tenant_id
  order by
    case memberships.role
      when 'owner' then 1
      when 'admin' then 2
      when 'member' then 3
      else 4
    end,
    lower(btrim(users.email));
end;
$$;

create or replace function public.list_tenant_invitations(
  p_actor_user_id uuid,
  p_tenant_id uuid
)
returns table (
  id uuid,
  email text,
  role text,
  token text,
  status text,
  expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_tenant_members(p_actor_user_id, p_tenant_id) then
    raise exception 'member_management_forbidden';
  end if;

  perform public.expire_stale_invitations(p_tenant_id);

  return query
  select
    invitations.id,
    lower(btrim(invitations.email)) as email,
    invitations.role,
    invitations.token,
    invitations.status,
    invitations.expires_at,
    invitations.created_at,
    invitations.updated_at
  from public.invitations
  where invitations.tenant_id = p_tenant_id
    and invitations.status = 'pending'
  order by invitations.created_at desc;
end;
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

create or replace function public.accept_invitation(
  p_actor_user_id uuid,
  p_token text
)
returns table (
  invitation_id uuid,
  tenant_id uuid,
  membership_id uuid,
  role text,
  status text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_invitation public.invitations%rowtype;
  v_membership public.memberships%rowtype;
begin
  v_email := public.get_auth_user_email(p_actor_user_id);
  if v_email is null or v_email = '' then
    raise exception 'invite_actor_email_missing';
  end if;

  perform public.expire_stale_invitations(null);

  select *
    into v_invitation
    from public.invitations
   where token = p_token
     and status = 'pending'
   limit 1;

  if v_invitation.id is null then
    raise exception 'invite_token_invalid';
  end if;

  if v_invitation.expires_at <= now() then
    update public.invitations
       set status = 'expired',
           updated_at = now()
     where id = v_invitation.id;

    raise exception 'invite_token_expired';
  end if;

  if lower(btrim(v_invitation.email)) <> v_email then
    raise exception 'invite_email_mismatch';
  end if;

  insert into public.memberships (tenant_id, user_id, role, status)
  values (v_invitation.tenant_id, p_actor_user_id, v_invitation.role, 'active')
  on conflict (tenant_id, user_id)
  do update
     set role = excluded.role,
         status = 'active',
         updated_at = now()
  returning * into v_membership;

  update public.invitations
     set status = 'accepted',
         accepted_at = now(),
         accepted_by = p_actor_user_id,
         updated_at = now()
   where id = v_invitation.id;

  return query
  select
    v_invitation.id,
    v_membership.tenant_id,
    v_membership.id,
    v_membership.role,
    v_membership.status;
end;
$$;

create or replace function public.update_membership_role(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_membership_id uuid,
  p_role text
)
returns public.memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_target public.memberships%rowtype;
begin
  if coalesce(p_role, '') not in ('admin', 'member', 'viewer') then
    raise exception 'membership_role_invalid';
  end if;

  v_actor_role := public.get_user_role_in_tenant(p_actor_user_id, p_tenant_id);
  if v_actor_role not in ('owner', 'admin') then
    raise exception 'member_management_forbidden';
  end if;

  select *
    into v_target
    from public.memberships
   where id = p_membership_id
     and tenant_id = p_tenant_id
   limit 1;

  if v_target.id is null then
    raise exception 'membership_not_found';
  end if;

  if v_target.user_id = p_actor_user_id then
    raise exception 'membership_self_role_change_forbidden';
  end if;

  if v_target.role = 'owner' then
    raise exception 'membership_owner_role_locked';
  end if;

  if v_actor_role = 'admin' and v_target.role = 'admin' then
    raise exception 'membership_admin_target_forbidden';
  end if;

  update public.memberships
     set role = p_role,
         updated_at = now()
   where id = v_target.id
  returning * into v_target;

  return v_target;
end;
$$;

create or replace function public.set_membership_status(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_membership_id uuid,
  p_status text
)
returns public.memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_target public.memberships%rowtype;
begin
  if coalesce(p_status, '') not in ('active', 'suspended') then
    raise exception 'membership_status_invalid';
  end if;

  v_actor_role := public.get_user_role_in_tenant(p_actor_user_id, p_tenant_id);
  if v_actor_role not in ('owner', 'admin') then
    raise exception 'member_management_forbidden';
  end if;

  select *
    into v_target
    from public.memberships
   where id = p_membership_id
     and tenant_id = p_tenant_id
   limit 1;

  if v_target.id is null then
    raise exception 'membership_not_found';
  end if;

  if v_target.user_id = p_actor_user_id then
    raise exception 'membership_self_status_change_forbidden';
  end if;

  if v_actor_role = 'admin' and v_target.role = 'admin' then
    raise exception 'membership_admin_target_forbidden';
  end if;

  if v_target.role = 'owner' and p_status = 'suspended' and public.count_active_owners(p_tenant_id) <= 1 then
    raise exception 'membership_last_owner_forbidden';
  end if;

  update public.memberships
     set status = p_status,
         updated_at = now()
   where id = v_target.id
  returning * into v_target;

  return v_target;
end;
$$;

create or replace function public.remove_membership(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_membership_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_target public.memberships%rowtype;
begin
  v_actor_role := public.get_user_role_in_tenant(p_actor_user_id, p_tenant_id);
  if v_actor_role not in ('owner', 'admin') then
    raise exception 'member_management_forbidden';
  end if;

  select *
    into v_target
    from public.memberships
   where id = p_membership_id
     and tenant_id = p_tenant_id
   limit 1;

  if v_target.id is null then
    raise exception 'membership_not_found';
  end if;

  if v_target.user_id = p_actor_user_id then
    raise exception 'membership_self_remove_forbidden';
  end if;

  if v_actor_role = 'admin' and v_target.role not in ('member', 'viewer') then
    raise exception 'membership_admin_target_forbidden';
  end if;

  if v_target.role = 'owner' and public.count_active_owners(p_tenant_id) <= 1 then
    raise exception 'membership_last_owner_forbidden';
  end if;

  delete from public.memberships
   where id = v_target.id;

  return v_target.id;
end;
$$;

revoke all on function public.can_manage_tenant_members(uuid, uuid) from public;
revoke all on function public.get_auth_user_email(uuid) from public;
revoke all on function public.count_active_owners(uuid) from public;
revoke all on function public.expire_stale_invitations(uuid) from public;
revoke all on function public.list_tenant_members(uuid, uuid) from public;
revoke all on function public.list_tenant_invitations(uuid, uuid) from public;
revoke all on function public.create_invitation(uuid, uuid, text, text) from public;
revoke all on function public.accept_invitation(uuid, text) from public;
revoke all on function public.update_membership_role(uuid, uuid, uuid, text) from public;
revoke all on function public.set_membership_status(uuid, uuid, uuid, text) from public;
revoke all on function public.remove_membership(uuid, uuid, uuid) from public;

grant execute on function public.can_manage_tenant_members(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_auth_user_email(uuid) to authenticated, service_role;
grant execute on function public.count_active_owners(uuid) to authenticated, service_role;
grant execute on function public.expire_stale_invitations(uuid) to authenticated, service_role;
grant execute on function public.list_tenant_members(uuid, uuid) to authenticated, service_role;
grant execute on function public.list_tenant_invitations(uuid, uuid) to authenticated, service_role;
grant execute on function public.create_invitation(uuid, uuid, text, text) to authenticated, service_role;
grant execute on function public.accept_invitation(uuid, text) to authenticated, service_role;
grant execute on function public.update_membership_role(uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function public.set_membership_status(uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function public.remove_membership(uuid, uuid, uuid) to authenticated, service_role;

drop policy if exists "authenticated invitations select by management role" on public.invitations;
create policy "authenticated invitations select by management role"
  on public.invitations
  for select
  to authenticated
  using (
    public.get_user_role_in_tenant(auth.uid(), tenant_id) in ('owner', 'admin')
  );
