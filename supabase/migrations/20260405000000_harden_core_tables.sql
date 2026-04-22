-- supabase/migrations/20260405000000_harden_core_tables.sql

-- Lock core data tables to service_role only.
alter table if exists public.accounts enable row level security;
alter table if exists public.payees enable row level security;
alter table if exists public.category_groups enable row level security;
alter table if exists public.fin_categories enable row level security;
alter table if exists public.transactions enable row level security;
alter table if exists public.fin_rules enable row level security;
alter table if exists public.activities enable row level security;
alter table if exists public.interaction_logs enable row level security;
alter table if exists public.receivables enable row level security;
alter table if exists public.activity_templates enable row level security;

drop policy if exists "Public accounts" on public.accounts;
drop policy if exists "Public payees" on public.payees;
drop policy if exists "Public category_groups" on public.category_groups;
drop policy if exists "Public fin_categories" on public.fin_categories;
drop policy if exists "Public transactions" on public.transactions;
drop policy if exists "Public fin_rules" on public.fin_rules;
drop policy if exists "Enable read access for all users" on public.activities;
drop policy if exists "Enable insert access for all users" on public.activities;
drop policy if exists "Enable update access for all users" on public.activities;
drop policy if exists "Enable delete access for all users" on public.activities;
drop policy if exists "Enable read access for all users" on public.interaction_logs;
drop policy if exists "Enable insert access for all users" on public.interaction_logs;
drop policy if exists "Enable update access for all users" on public.interaction_logs;
drop policy if exists "Enable delete access for all users" on public.interaction_logs;
drop policy if exists "public access" on public.receivables;
drop policy if exists "public access" on public.activity_templates;

drop policy if exists "service role full access" on public.accounts;
create policy "service role full access" on public.accounts for all to service_role using (true) with check (true);

drop policy if exists "service role full access" on public.payees;
create policy "service role full access" on public.payees for all to service_role using (true) with check (true);

drop policy if exists "service role full access" on public.category_groups;
create policy "service role full access" on public.category_groups for all to service_role using (true) with check (true);

drop policy if exists "service role full access" on public.fin_categories;
create policy "service role full access" on public.fin_categories for all to service_role using (true) with check (true);

drop policy if exists "service role full access" on public.transactions;
create policy "service role full access" on public.transactions for all to service_role using (true) with check (true);

drop policy if exists "service role full access" on public.fin_rules;
create policy "service role full access" on public.fin_rules for all to service_role using (true) with check (true);

drop policy if exists "service role full access" on public.activities;
create policy "service role full access" on public.activities for all to service_role using (true) with check (true);

drop policy if exists "service role full access" on public.interaction_logs;
create policy "service role full access" on public.interaction_logs for all to service_role using (true) with check (true);

drop policy if exists "service role full access" on public.receivables;
create policy "service role full access" on public.receivables for all to service_role using (true) with check (true);

drop policy if exists "service role full access" on public.activity_templates;
create policy "service role full access" on public.activity_templates for all to service_role using (true) with check (true);

-- Align receivables.activity_id with the real type of activities.id.
do $$
declare
  activities_id_type text;
  activity_id_type text;
  has_non_null_values boolean;
  fk_name text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into activities_id_type
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'activities'
     and a.attname = 'id'
     and a.attnum > 0
     and not a.attisdropped;

  if activities_id_type is null then
    raise exception 'public.activities.id not found';
  end if;

  select format_type(a.atttypid, a.atttypmod)
    into activity_id_type
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'receivables'
     and a.attname = 'activity_id'
     and a.attnum > 0
     and not a.attisdropped;

  if activity_id_type is null then
    execute format(
      'alter table public.receivables add column activity_id %s references public.activities(id)',
      activities_id_type
    );
  elsif activity_id_type <> activities_id_type then
    execute 'select exists (select 1 from public.receivables where activity_id is not null)'
      into has_non_null_values;

    if has_non_null_values then
      raise exception 'receivables.activity_id has existing values with type %, expected %; migrate data manually before converting',
        activity_id_type,
        activities_id_type;
    end if;

    for fk_name in
      select tc.constraint_name
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on tc.constraint_name = kcu.constraint_name
         and tc.table_schema = kcu.table_schema
       where tc.table_schema = 'public'
         and tc.table_name = 'receivables'
         and tc.constraint_type = 'FOREIGN KEY'
         and kcu.column_name = 'activity_id'
    loop
      execute format('alter table public.receivables drop constraint %I', fk_name);
    end loop;

    alter table public.receivables drop column activity_id;
    execute format(
      'alter table public.receivables add column activity_id %s references public.activities(id)',
      activities_id_type
    );
  end if;
end $$;
