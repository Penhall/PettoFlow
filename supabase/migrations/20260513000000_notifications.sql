-- supabase/migrations/20260513000000_notifications.sql

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  resource_type text,
  resource_id text,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notifications_type_check check (
    type in (
      'activity_reminder',
      'task_assigned',
      'task_updated',
      'task_due',
      'mention',
      'system'
    )
  )
);

alter table if exists public.activities
  add column if not exists notified_at timestamptz;

alter table public.notifications
  add constraint notifications_unique_user_resource
  unique (user_id, resource_type, resource_id, type);

alter table public.notifications enable row level security;

drop policy if exists "service role full access" on public.notifications;
create policy "service role full access"
  on public.notifications
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "authenticated users select own notifications" on public.notifications;
create policy "authenticated users select own notifications"
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "authenticated users update own notifications" on public.notifications;
create policy "authenticated users update own notifications"
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, update on public.notifications to authenticated;

create index if not exists notifications_user_read_created_at_idx
  on public.notifications (user_id, read, created_at desc);

create index if not exists notifications_tenant_id_idx
  on public.notifications (tenant_id);

drop index if exists activities_notified_at_idx;

create index if not exists activities_pending_unnotified_scheduled_idx
  on public.activities (scheduled_at)
  where status = 'pending' and notified_at is null;
