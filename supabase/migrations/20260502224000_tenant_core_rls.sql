alter table if exists public.tenants enable row level security;
alter table if exists public.memberships enable row level security;
alter table if exists public.tenant_settings enable row level security;

drop policy if exists "authenticated tenants select by membership" on public.tenants;
create policy "authenticated tenants select by membership"
  on public.tenants
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.memberships
       where memberships.tenant_id = tenants.id
         and memberships.user_id = auth.uid()
         and memberships.status = 'active'
    )
  );

drop policy if exists "authenticated tenants update by role" on public.tenants;
create policy "authenticated tenants update by role"
  on public.tenants
  for update
  to authenticated
  using (
    exists (
      select 1
        from public.memberships
       where memberships.tenant_id = tenants.id
         and memberships.user_id = auth.uid()
         and memberships.status = 'active'
         and memberships.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
        from public.memberships
       where memberships.tenant_id = tenants.id
         and memberships.user_id = auth.uid()
         and memberships.status = 'active'
         and memberships.role in ('owner', 'admin')
    )
  );

drop policy if exists "authenticated memberships select by participation" on public.memberships;
create policy "authenticated memberships select by participation"
  on public.memberships
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.memberships as viewer_memberships
       where viewer_memberships.tenant_id = memberships.tenant_id
         and viewer_memberships.user_id = auth.uid()
         and viewer_memberships.status = 'active'
    )
  );

drop policy if exists "authenticated tenant settings select by membership" on public.tenant_settings;
create policy "authenticated tenant settings select by membership"
  on public.tenant_settings
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.memberships
       where memberships.tenant_id = tenant_settings.tenant_id
         and memberships.user_id = auth.uid()
         and memberships.status = 'active'
    )
  );

drop policy if exists "authenticated tenant settings update by role" on public.tenant_settings;
create policy "authenticated tenant settings update by role"
  on public.tenant_settings
  for update
  to authenticated
  using (
    exists (
      select 1
        from public.memberships
       where memberships.tenant_id = tenant_settings.tenant_id
         and memberships.user_id = auth.uid()
         and memberships.status = 'active'
         and memberships.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
        from public.memberships
       where memberships.tenant_id = tenant_settings.tenant_id
         and memberships.user_id = auth.uid()
         and memberships.status = 'active'
         and memberships.role in ('owner', 'admin')
    )
  );
