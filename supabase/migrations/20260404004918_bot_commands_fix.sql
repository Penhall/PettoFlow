-- Fix RLS policy: scope to service_role only
drop policy if exists "service role full access" on bot_commands;
create policy "service role full access"
  on bot_commands
  to service_role
  using (true)
  with check (true);

-- Fix is_default default value
alter table bot_commands alter column is_default set default false;

-- Add updated_at
alter table bot_commands add column if not exists updated_at timestamptz default now() not null;;
