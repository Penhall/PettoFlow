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

  return v_tenant_id;
end;
$$;

revoke all on function public.create_tenant_with_owner(uuid, text, text) from public;
grant execute on function public.create_tenant_with_owner(uuid, text, text) to authenticated;
grant execute on function public.create_tenant_with_owner(uuid, text, text) to service_role;

create or replace function public.is_member_of_tenant(
  p_user_id uuid,
  p_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
      from public.memberships
     where memberships.user_id = p_user_id
       and memberships.tenant_id = p_tenant_id
  );
$$;

create or replace function public.is_active_member(
  p_user_id uuid,
  p_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
      from public.memberships
     where memberships.user_id = p_user_id
       and memberships.tenant_id = p_tenant_id
       and memberships.status = 'active'
  );
$$;

create or replace function public.get_user_role_in_tenant(
  p_user_id uuid,
  p_tenant_id uuid
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select memberships.role
    from public.memberships
   where memberships.user_id = p_user_id
     and memberships.tenant_id = p_tenant_id
     and memberships.status = 'active'
   order by memberships.created_at asc
   limit 1;
$$;

revoke all on function public.is_member_of_tenant(uuid, uuid) from public;
revoke all on function public.is_active_member(uuid, uuid) from public;
revoke all on function public.get_user_role_in_tenant(uuid, uuid) from public;

grant execute on function public.is_member_of_tenant(uuid, uuid) to authenticated;
grant execute on function public.is_active_member(uuid, uuid) to authenticated;
grant execute on function public.get_user_role_in_tenant(uuid, uuid) to authenticated;
grant execute on function public.is_member_of_tenant(uuid, uuid) to service_role;
grant execute on function public.is_active_member(uuid, uuid) to service_role;
grant execute on function public.get_user_role_in_tenant(uuid, uuid) to service_role;

drop policy if exists "authenticated tenants select by membership" on public.tenants;
create policy "authenticated tenants select by membership"
  on public.tenants
  for select
  to authenticated
  using (
    public.is_active_member(auth.uid(), id)
  );

drop policy if exists "authenticated tenants update by role" on public.tenants;
create policy "authenticated tenants update by role"
  on public.tenants
  for update
  to authenticated
  using (
    public.get_user_role_in_tenant(auth.uid(), id) in ('owner', 'admin')
  )
  with check (
    public.get_user_role_in_tenant(auth.uid(), id) in ('owner', 'admin')
  );

drop policy if exists "authenticated memberships select by participation" on public.memberships;
create policy "authenticated memberships select by participation"
  on public.memberships
  for select
  to authenticated
  using (
    public.is_active_member(auth.uid(), tenant_id)
  );

drop policy if exists "authenticated tenant settings select by membership" on public.tenant_settings;
create policy "authenticated tenant settings select by membership"
  on public.tenant_settings
  for select
  to authenticated
  using (
    public.is_active_member(auth.uid(), tenant_id)
  );

drop policy if exists "authenticated tenant settings insert by role" on public.tenant_settings;
create policy "authenticated tenant settings insert by role"
  on public.tenant_settings
  for insert
  to authenticated
  with check (
    public.get_user_role_in_tenant(auth.uid(), tenant_id) in ('owner', 'admin')
  );

drop policy if exists "authenticated tenant settings update by role" on public.tenant_settings;
create policy "authenticated tenant settings update by role"
  on public.tenant_settings
  for update
  to authenticated
  using (
    public.get_user_role_in_tenant(auth.uid(), tenant_id) in ('owner', 'admin')
  )
  with check (
    public.get_user_role_in_tenant(auth.uid(), tenant_id) in ('owner', 'admin')
  );

create or replace function public.apply_standard_tenant_policies(
  p_table_name text
)
returns void
language plpgsql
as $$
begin
  if to_regclass(format('public.%I', p_table_name)) is null then
    return;
  end if;

  execute format('alter table public.%I enable row level security', p_table_name);

  execute format('drop policy if exists %I on public.%I', p_table_name || '_tenant_select', p_table_name);
  execute format($sql$
    create policy %I
      on public.%I
      for select
      to authenticated
      using (
        public.is_active_member(auth.uid(), tenant_id)
      )
  $sql$, p_table_name || '_tenant_select', p_table_name);

  execute format('drop policy if exists %I on public.%I', p_table_name || '_tenant_insert', p_table_name);
  execute format($sql$
    create policy %I
      on public.%I
      for insert
      to authenticated
      with check (
        public.is_active_member(auth.uid(), tenant_id)
        and public.get_user_role_in_tenant(auth.uid(), tenant_id) in ('owner', 'admin', 'member')
      )
  $sql$, p_table_name || '_tenant_insert', p_table_name);

  execute format('drop policy if exists %I on public.%I', p_table_name || '_tenant_update', p_table_name);
  execute format($sql$
    create policy %I
      on public.%I
      for update
      to authenticated
      using (
        public.is_active_member(auth.uid(), tenant_id)
      )
      with check (
        public.is_active_member(auth.uid(), tenant_id)
        and public.get_user_role_in_tenant(auth.uid(), tenant_id) in ('owner', 'admin', 'member')
      )
  $sql$, p_table_name || '_tenant_update', p_table_name);

  execute format('drop policy if exists %I on public.%I', p_table_name || '_tenant_delete', p_table_name);
  execute format($sql$
    create policy %I
      on public.%I
      for delete
      to authenticated
      using (
        public.get_user_role_in_tenant(auth.uid(), tenant_id) in ('owner', 'admin')
      )
  $sql$, p_table_name || '_tenant_delete', p_table_name);
end;
$$;

select public.apply_standard_tenant_policies('tasks');
select public.apply_standard_tenant_policies('kanban_columns');
select public.apply_standard_tenant_policies('team');
select public.apply_standard_tenant_policies('clients');
select public.apply_standard_tenant_policies('activities');
select public.apply_standard_tenant_policies('activity_templates');
select public.apply_standard_tenant_policies('accounts');
select public.apply_standard_tenant_policies('payees');
select public.apply_standard_tenant_policies('fin_rules');
select public.apply_standard_tenant_policies('category_groups');
select public.apply_standard_tenant_policies('fin_categories');
select public.apply_standard_tenant_policies('transactions');
select public.apply_standard_tenant_policies('receivables');
select public.apply_standard_tenant_policies('interaction_logs');
select public.apply_standard_tenant_policies('bot_configs');
select public.apply_standard_tenant_policies('bot_commands');

drop function if exists public.apply_standard_tenant_policies(text);
