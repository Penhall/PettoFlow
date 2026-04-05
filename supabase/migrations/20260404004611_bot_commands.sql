-- supabase/migrations/20260403000000_bot_commands.sql

create table if not exists bot_commands (
  id            uuid primary key default gen_random_uuid(),
  bot_config_id uuid references bot_configs(id) on delete cascade not null,
  trigger       text not null,
  description   text not null,
  type          text not null check (type in ('builtin', 'shortcut', 'template', 'multi')),
  actions       jsonb not null default '[]'::jsonb,
  examples      text[] default '{}',
  category      text not null check (category in ('tasks', 'activities', 'finance', 'custom')),
  is_active     boolean default true not null,
  is_default    boolean default true not null,
  created_at    timestamptz default now() not null
);

alter table bot_commands enable row level security;

create policy "service role full access"
  on bot_commands
  using (true)
  with check (true);;
