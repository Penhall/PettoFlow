-- Bucket será criado via Supabase Dashboard ou Storage API
-- Mas precisamos da tabela de rastreamento

create table if not exists public.file_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  file_name text not null,
  file_size integer not null,
  mime_type text,
  storage_path text not null,
  entity_type text not null,
  entity_id text not null,
  created_at timestamptz not null default now(),
  constraint file_attachments_entity_type_check check (
    entity_type in ('client', 'task', 'transaction')
  )
);

alter table public.file_attachments enable row level security;

-- Policies
drop policy if exists "service role full access" on public.file_attachments;
create policy "service role full access"
  on public.file_attachments for all to service_role using (true) with check (true);

drop policy if exists "authenticated select own tenant attachments" on public.file_attachments;
create policy "authenticated select own tenant attachments"
  on public.file_attachments for select to authenticated
  using (tenant_id in (
    select tenant_id from public.memberships where user_id = auth.uid() and status = 'active'
  ));

drop policy if exists "authenticated insert own tenant attachments" on public.file_attachments;
create policy "authenticated insert own tenant attachments"
  on public.file_attachments for insert to authenticated
  with check (tenant_id in (
    select tenant_id from public.memberships where user_id = auth.uid() and status = 'active'
  ));

drop policy if exists "authenticated delete own tenant attachments" on public.file_attachments;
create policy "authenticated delete own tenant attachments"
  on public.file_attachments for delete to authenticated
  using (tenant_id in (
    select tenant_id from public.memberships where user_id = auth.uid() and status = 'active'
  ));

grant select, insert, delete on public.file_attachments to authenticated;

create index if not exists file_attachments_entity_idx on public.file_attachments (entity_type, entity_id);
create index if not exists file_attachments_tenant_idx on public.file_attachments (tenant_id);

drop policy if exists "authenticated select own tenant files" on storage.objects;
create policy "authenticated select own tenant files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'nexuscrm-files'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from public.memberships where user_id = auth.uid() and status = 'active'
    )
  );

drop policy if exists "authenticated insert own tenant files" on storage.objects;
create policy "authenticated insert own tenant files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'nexuscrm-files'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from public.memberships where user_id = auth.uid() and status = 'active'
    )
  );

drop policy if exists "authenticated delete own tenant files" on storage.objects;
create policy "authenticated delete own tenant files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'nexuscrm-files'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from public.memberships where user_id = auth.uid() and status = 'active'
    )
  );
