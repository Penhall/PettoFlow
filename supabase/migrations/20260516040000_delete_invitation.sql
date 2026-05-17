-- Migration: delete_invitation RPC
-- Permite que admins cancelem/excluam convites pendentes

create or replace function public.delete_invitation(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_invitation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.invitations%rowtype;
begin
  -- Verificar se o ator pode gerenciar membros
  if not public.can_manage_tenant_members(p_actor_user_id, p_tenant_id) then
    raise exception 'member_management_forbidden';
  end if;

  -- Buscar o convite e verificar se pertence ao tenant
  select * into v_invitation
  from public.invitations
  where id = p_invitation_id
    and tenant_id = p_tenant_id;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'invitation_not_pending';
  end if;

  -- Excluir o convite
  delete from public.invitations
  where id = p_invitation_id
    and tenant_id = p_tenant_id;

  return p_invitation_id;
end;
$$;

revoke all on function public.delete_invitation(uuid, uuid, uuid) from public;
grant execute on function public.delete_invitation(uuid, uuid, uuid) to authenticated, service_role;
