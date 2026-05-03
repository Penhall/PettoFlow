-- supabase/migrations/20260502171000_tenant_id_business_tables.sql

-- Add tenant_id to business and tenant-scoped config tables.
-- This migration is intentionally split between:
-- 1. structural preparation
-- 2. conditional backfill/finalization if the default migrated tenant already exists

create or replace function public.add_tenant_column_and_fk(
  p_table_name text,
  p_constraint_name text
)
returns void
language plpgsql
as $$
declare
  v_table regclass;
begin
  v_table := to_regclass(format('public.%I', p_table_name));
  if v_table is null then
    return;
  end if;

  execute format(
    'alter table public.%I add column if not exists tenant_id uuid',
    p_table_name
  );

  if not exists (
    select 1
      from pg_constraint
     where conname = p_constraint_name
       and conrelid = v_table
  ) then
    execute format(
      'alter table public.%I add constraint %I foreign key (tenant_id) references public.tenants(id)',
      p_table_name,
      p_constraint_name
    );
  end if;
end;
$$;

create or replace function public.create_table_index_if_exists(
  p_table_name text,
  p_index_name text,
  p_columns_sql text,
  p_unique boolean default false
)
returns void
language plpgsql
as $$
begin
  if to_regclass(format('public.%I', p_table_name)) is null then
    return;
  end if;

  execute format(
    'create %s index if not exists %I on public.%I %s',
    case when p_unique then 'unique' else '' end,
    p_index_name,
    p_table_name,
    p_columns_sql
  );
end;
$$;

create or replace function public.create_tenant_with_owner(
  p_owner_user_id uuid,
  p_name text default 'Workspace Migrado',
  p_slug text default 'workspace-migrado'
)
returns uuid
language plpgsql
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

create or replace function public.finalize_legacy_tenant_columns()
returns void
language plpgsql
as $$
declare
  v_table_name text;
  v_has_nulls boolean;
  v_tables text[] := array[
    'tasks',
    'team',
    'clients',
    'kanban_columns',
    'activities',
    'activity_templates',
    'accounts',
    'payees',
    'fin_rules',
    'category_groups',
    'fin_categories',
    'transactions',
    'receivables',
    'interaction_logs',
    'bot_configs',
    'bot_commands'
  ];
begin
  foreach v_table_name in array v_tables loop
    if to_regclass(format('public.%I', v_table_name)) is null then
      continue;
    end if;

    execute format(
      'select exists(select 1 from public.%I where tenant_id is null)',
      v_table_name
    )
    into v_has_nulls;

    if v_has_nulls then
      raise exception 'table %.tenant_id still contains null values', v_table_name;
    end if;

    execute format(
      'alter table public.%I alter column tenant_id set not null',
      v_table_name
    );
  end loop;
end;
$$;

create or replace function public.backfill_legacy_tenant(
  p_tenant_id uuid
)
returns void
language plpgsql
as $$
begin
  perform 1
    from public.tenants
   where id = p_tenant_id;

  if not found then
    raise exception 'tenant % not found', p_tenant_id;
  end if;

  if to_regclass('public.tasks') is not null then
    update public.tasks set tenant_id = p_tenant_id where tenant_id is null;
  end if;

  if to_regclass('public.team') is not null then
    update public.team set tenant_id = p_tenant_id where tenant_id is null;
  end if;

  if to_regclass('public.clients') is not null then
    update public.clients set tenant_id = p_tenant_id where tenant_id is null;
  end if;

  if to_regclass('public.kanban_columns') is not null then
    update public.kanban_columns set tenant_id = p_tenant_id where tenant_id is null;
  end if;

  if to_regclass('public.activities') is not null then
    update public.activities set tenant_id = p_tenant_id where tenant_id is null;
  end if;

  if to_regclass('public.activity_templates') is not null then
    update public.activity_templates set tenant_id = p_tenant_id where tenant_id is null;
  end if;

  if to_regclass('public.accounts') is not null then
    update public.accounts set tenant_id = p_tenant_id where tenant_id is null;
  end if;

  if to_regclass('public.payees') is not null then
    update public.payees set tenant_id = p_tenant_id where tenant_id is null;
  end if;

  if to_regclass('public.fin_rules') is not null then
    update public.fin_rules set tenant_id = p_tenant_id where tenant_id is null;
  end if;

  if to_regclass('public.category_groups') is not null then
    update public.category_groups set tenant_id = p_tenant_id where tenant_id is null;
  end if;

  if to_regclass('public.fin_categories') is not null then
    update public.fin_categories set tenant_id = p_tenant_id where tenant_id is null;
  end if;

  if to_regclass('public.transactions') is not null then
    update public.transactions set tenant_id = p_tenant_id where tenant_id is null;
  end if;

  if to_regclass('public.receivables') is not null then
    update public.receivables set tenant_id = p_tenant_id where tenant_id is null;
  end if;

  if to_regclass('public.interaction_logs') is not null then
    update public.interaction_logs set tenant_id = p_tenant_id where tenant_id is null;
  end if;

  if to_regclass('public.bot_configs') is not null then
    update public.bot_configs set tenant_id = p_tenant_id where tenant_id is null;
  end if;

  if to_regclass('public.bot_commands') is not null and to_regclass('public.bot_configs') is not null then
    update public.bot_commands as commands
       set tenant_id = configs.tenant_id
      from public.bot_configs as configs
     where commands.bot_config_id = configs.id
       and commands.tenant_id is null
       and configs.tenant_id is not null;
  end if;

  if to_regclass('public.bot_commands') is not null then
    update public.bot_commands set tenant_id = p_tenant_id where tenant_id is null;
  end if;

  perform public.finalize_legacy_tenant_columns();
end;
$$;

select public.add_tenant_column_and_fk('tasks', 'tasks_tenant_id_fkey');
select public.add_tenant_column_and_fk('team', 'team_tenant_id_fkey');
select public.add_tenant_column_and_fk('clients', 'clients_tenant_id_fkey');
select public.add_tenant_column_and_fk('kanban_columns', 'kanban_columns_tenant_id_fkey');
select public.add_tenant_column_and_fk('activities', 'activities_tenant_id_fkey');
select public.add_tenant_column_and_fk('activity_templates', 'activity_templates_tenant_id_fkey');
select public.add_tenant_column_and_fk('accounts', 'accounts_tenant_id_fkey');
select public.add_tenant_column_and_fk('payees', 'payees_tenant_id_fkey');
select public.add_tenant_column_and_fk('fin_rules', 'fin_rules_tenant_id_fkey');
select public.add_tenant_column_and_fk('category_groups', 'category_groups_tenant_id_fkey');
select public.add_tenant_column_and_fk('fin_categories', 'fin_categories_tenant_id_fkey');
select public.add_tenant_column_and_fk('transactions', 'transactions_tenant_id_fkey');
select public.add_tenant_column_and_fk('receivables', 'receivables_tenant_id_fkey');
select public.add_tenant_column_and_fk('interaction_logs', 'interaction_logs_tenant_id_fkey');
select public.add_tenant_column_and_fk('bot_configs', 'bot_configs_tenant_id_fkey');
select public.add_tenant_column_and_fk('bot_commands', 'bot_commands_tenant_id_fkey');

select public.create_table_index_if_exists('tasks', 'tasks_tenant_id_idx', '(tenant_id)');
select public.create_table_index_if_exists('tasks', 'tasks_tenant_created_at_idx', '(tenant_id, created_at desc)');
select public.create_table_index_if_exists('tasks', 'tasks_tenant_status_idx', '(tenant_id, status)');
select public.create_table_index_if_exists('tasks', 'tasks_tenant_client_id_idx', '(tenant_id, client_id)');

select public.create_table_index_if_exists('team', 'team_tenant_id_idx', '(tenant_id)');
select public.create_table_index_if_exists('team', 'team_tenant_status_idx', '(tenant_id, status)');

select public.create_table_index_if_exists('clients', 'clients_tenant_id_idx', '(tenant_id)');
select public.create_table_index_if_exists('clients', 'clients_tenant_name_idx', '(tenant_id, name)');

select public.create_table_index_if_exists('kanban_columns', 'kanban_columns_tenant_id_idx', '(tenant_id)');
select public.create_table_index_if_exists('kanban_columns', 'kanban_columns_tenant_order_idx', '(tenant_id, order_index)');

select public.create_table_index_if_exists('activities', 'activities_tenant_id_idx', '(tenant_id)');
select public.create_table_index_if_exists('activities', 'activities_tenant_created_at_idx', '(tenant_id, created_at desc)');

select public.create_table_index_if_exists('activity_templates', 'activity_templates_tenant_id_idx', '(tenant_id)');
select public.create_table_index_if_exists('activity_templates', 'activity_templates_tenant_name_idx', '(tenant_id, name)');

select public.create_table_index_if_exists('accounts', 'accounts_tenant_id_idx', '(tenant_id)');
select public.create_table_index_if_exists('accounts', 'accounts_tenant_active_idx', '(tenant_id, is_active)');

select public.create_table_index_if_exists('payees', 'payees_tenant_id_idx', '(tenant_id)');
select public.create_table_index_if_exists('payees', 'payees_tenant_name_idx', '(tenant_id, name)');

select public.create_table_index_if_exists('fin_rules', 'fin_rules_tenant_id_idx', '(tenant_id)');
select public.create_table_index_if_exists('fin_rules', 'fin_rules_tenant_priority_idx', '(tenant_id, priority)');

select public.create_table_index_if_exists('category_groups', 'category_groups_tenant_id_idx', '(tenant_id)');
select public.create_table_index_if_exists('category_groups', 'category_groups_tenant_sort_idx', '(tenant_id, sort_order)');

select public.create_table_index_if_exists('fin_categories', 'fin_categories_tenant_id_idx', '(tenant_id)');
select public.create_table_index_if_exists('fin_categories', 'fin_categories_tenant_group_idx', '(tenant_id, group_id)');
select public.create_table_index_if_exists('fin_categories', 'fin_categories_tenant_sort_idx', '(tenant_id, sort_order)');

select public.create_table_index_if_exists('transactions', 'transactions_tenant_id_idx', '(tenant_id)');
select public.create_table_index_if_exists('transactions', 'transactions_tenant_date_idx', '(tenant_id, date desc)');
select public.create_table_index_if_exists('transactions', 'transactions_tenant_account_idx', '(tenant_id, account_id)');
select public.create_table_index_if_exists('transactions', 'transactions_tenant_category_idx', '(tenant_id, category_id)');

select public.create_table_index_if_exists('receivables', 'receivables_tenant_id_idx', '(tenant_id)');
select public.create_table_index_if_exists('receivables', 'receivables_tenant_created_at_idx', '(tenant_id, created_at desc)');
select public.create_table_index_if_exists('receivables', 'receivables_tenant_status_idx', '(tenant_id, status)');
select public.create_table_index_if_exists('receivables', 'receivables_tenant_task_idx', '(tenant_id, task_id)');
select public.create_table_index_if_exists('receivables', 'receivables_tenant_activity_idx', '(tenant_id, activity_id)');

select public.create_table_index_if_exists('interaction_logs', 'interaction_logs_tenant_id_idx', '(tenant_id)');
select public.create_table_index_if_exists('interaction_logs', 'interaction_logs_tenant_client_idx', '(tenant_id, client_id)');
select public.create_table_index_if_exists('interaction_logs', 'interaction_logs_tenant_created_at_idx', '(tenant_id, created_at desc)');

select public.create_table_index_if_exists('bot_configs', 'bot_configs_tenant_id_idx', '(tenant_id)');
select public.create_table_index_if_exists('bot_configs', 'bot_configs_tenant_id_uidx', '(tenant_id)', true);

select public.create_table_index_if_exists('bot_commands', 'bot_commands_tenant_id_idx', '(tenant_id)');
select public.create_table_index_if_exists('bot_commands', 'bot_commands_tenant_bot_config_idx', '(tenant_id, bot_config_id)');

do $$
declare
  v_constraint_name text;
  v_index_name text;
begin
  if to_regclass('public.kanban_columns') is not null then
    for v_constraint_name in
      select tc.constraint_name
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on tc.constraint_name = kcu.constraint_name
         and tc.table_schema = kcu.table_schema
       where tc.table_schema = 'public'
         and tc.table_name = 'kanban_columns'
         and tc.constraint_type = 'UNIQUE'
       group by tc.constraint_name
      having count(*) = 1
         and max(kcu.column_name) = 'name'
    loop
      execute format('alter table public.kanban_columns drop constraint %I', v_constraint_name);
    end loop;

    for v_index_name in
      select indexname
        from pg_indexes
       where schemaname = 'public'
         and tablename = 'kanban_columns'
         and indexdef ilike 'create unique index % on public.kanban_columns using btree (name)%'
    loop
      execute format('drop index if exists public.%I', v_index_name);
    end loop;
  end if;
end $$;

select public.create_table_index_if_exists(
  'kanban_columns',
  'kanban_columns_tenant_name_uidx',
  '(tenant_id, name)',
  true
);

do $$
declare
  v_default_tenant_id uuid;
begin
  select id
    into v_default_tenant_id
    from public.tenants
   where lower(slug) = 'workspace-migrado'
   limit 1;

  if v_default_tenant_id is not null then
    perform public.backfill_legacy_tenant(v_default_tenant_id);
  else
    raise notice 'workspace-migrado tenant not found. Run public.create_tenant_with_owner(<owner_user_id>, ''Workspace Migrado'', ''workspace-migrado'') and then public.backfill_legacy_tenant(<tenant_id>) before enforcing tenant isolation.';
  end if;
end $$;
