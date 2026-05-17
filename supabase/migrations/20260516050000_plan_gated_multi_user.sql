-- Migration: plan-gated multi-user collaboration
-- Free → 1 user, features.multi_user = false
-- Growth → 5 users, features.multi_user = true
-- create_invitation bloqueia se plano não tem multi_user

-- 1. Atualizar seed dos planos com features
update public.plans
   set limits = '{"max_users": 1, "max_clients": 100, "max_tasks": 500, "max_activities": 500, "max_transactions": 1000, "features": {"multi_user": false, "calendar_view": false}}'::jsonb,
       updated_at = now()
 where slug = 'free';

update public.plans
   set limits = '{"max_users": 5, "max_clients": 1000, "max_tasks": 5000, "max_activities": 1000, "max_transactions": 5000, "features": {"multi_user": true, "calendar_view": true}}'::jsonb,
       updated_at = now()
 where slug = 'growth';

-- 2. RPC para verificar se um tenant tem uma feature habilitada no plano
create or replace function public.check_tenant_feature(
  p_tenant_id uuid,
  p_feature text
)
returns boolean
language plpgsql
stable
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
    return false;
  end if;

  return coalesce((v_limits -> 'features' -> p_feature)::boolean, false);
end;
$$;

revoke all on function public.check_tenant_feature(uuid, text) from public;
grant execute on function public.check_tenant_feature(uuid, text) to authenticated, service_role;

-- 3. Atualizar create_invitation para bloquear se plano não tem multi_user
-- (precisa dropar e recriar com a checagem adicional)
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

  -- Verificar se o plano permite multi-usuario
  if not public.check_tenant_feature(p_tenant_id, 'multi_user') then
    raise exception 'plan_does_not_support_multi_user';
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
         updated_at = now()
   where tenant_id = p_tenant_id
     and lower(btrim(email)) = v_email
     and status = 'pending';

  if found then
    select * into v_invitation
      from public.invitations
     where tenant_id = p_tenant_id
       and lower(btrim(email)) = v_email
       and status = 'pending'
     limit 1;

    return v_invitation;
  end if;

  insert into public.invitations (tenant_id, email, role, invited_by, token)
  values (p_tenant_id, v_email, p_role, p_actor_user_id, v_token)
  returning * into v_invitation;

  return v_invitation;
end;
$$;
