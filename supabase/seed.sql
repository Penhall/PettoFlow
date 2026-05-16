do $$
declare
  v_tenant_id uuid;
  v_user_id uuid := '00000000-0000-0000-0000-000000000101';
  v_col_id text;
  v_primary_account_id text;
  v_savings_account_id text;
  v_subscriptions_category_id text;
  v_office_category_id text;
  v_services_revenue_category_id text;
  v_has_column boolean;
begin
  select id into v_user_id from auth.users order by created_at limit 1;

  if v_user_id is null then
    v_user_id := '00000000-0000-0000-0000-000000000101';

    insert into auth.users (
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      v_user_id,
      'authenticated',
      'authenticated',
      'central-demo@pettoflow.local',
      '',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    )
    on conflict (id) do nothing;
  end if;

  select id into v_tenant_id
    from public.tenants
   where lower(slug) = 'central'
   limit 1;

  if v_tenant_id is null then
    insert into public.tenants (name, slug, owner_user_id)
    values ('Central', 'central', v_user_id)
    returning id into v_tenant_id;

    insert into public.memberships (tenant_id, user_id, role, status)
    values (v_tenant_id, v_user_id, 'owner', 'active')
    on conflict (tenant_id, user_id) do nothing;
  end if;

  select id::text into v_col_id
    from public.kanban_columns
   where tenant_id = v_tenant_id
   order by order_index
   limit 1;

  if v_col_id is null then
    insert into public.kanban_columns (tenant_id, name, order_index)
    values (v_tenant_id, 'A Fazer', 1)
    returning id::text into v_col_id;
  end if;

  if (select count(*) from public.activities where tenant_id = v_tenant_id) = 0 then
    select exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'activities' and column_name = 'date'
    ) into v_has_column;

    if v_has_column then
      insert into public.activities (tenant_id, user_id, type, title, description, date, time, duration_minutes, status)
      values
        (v_tenant_id, v_user_id, 'meeting', 'Reunião de planejamento semanal', 'Seed demo Fase B', current_date, '10:00'::time, 60, 'scheduled'),
        (v_tenant_id, v_user_id, 'call', 'Ligação para cliente ACME Corp', 'Seed demo Fase B', current_date, '14:00'::time, 30, 'scheduled'),
        (v_tenant_id, v_user_id, 'review', 'Revisão de orçamento mensal', 'Seed demo Fase B', current_date + 1, '09:00'::time, 45, 'scheduled'),
        (v_tenant_id, v_user_id, 'meeting', 'Alinhamento com equipe de design', 'Seed demo Fase B', current_date + 1, '15:00'::time, 60, 'scheduled'),
        (v_tenant_id, v_user_id, 'call', 'Follow-up proposta comercial', 'Seed demo Fase B', current_date + 2, '11:00'::time, 30, 'scheduled');
    else
      insert into public.activities (tenant_id, title, type, body, status, created_by, scheduled_at)
      values
        (v_tenant_id, 'Reunião de planejamento semanal', 'meeting', '{"description":"Seed demo Fase B","duration_minutes":60}'::jsonb, 'pending', v_user_id::text, current_date + time '10:00'),
        (v_tenant_id, 'Ligação para cliente ACME Corp', 'call', '{"description":"Seed demo Fase B","duration_minutes":30}'::jsonb, 'pending', v_user_id::text, current_date + time '14:00'),
        (v_tenant_id, 'Revisão de orçamento mensal', 'note', '{"type":"review","description":"Seed demo Fase B","duration_minutes":45}'::jsonb, 'pending', v_user_id::text, current_date + 1 + time '09:00'),
        (v_tenant_id, 'Alinhamento com equipe de design', 'meeting', '{"description":"Seed demo Fase B","duration_minutes":60}'::jsonb, 'pending', v_user_id::text, current_date + 1 + time '15:00'),
        (v_tenant_id, 'Follow-up proposta comercial', 'call', '{"description":"Seed demo Fase B","duration_minutes":30}'::jsonb, 'pending', v_user_id::text, current_date + 2 + time '11:00');
    end if;
  end if;

  if (select count(*) from public.accounts where tenant_id = v_tenant_id) = 0 then
    insert into public.accounts (tenant_id, name, type, is_active)
    values
      (v_tenant_id, 'Conta Corrente Principal', 'checking', true),
      (v_tenant_id, 'Conta Poupança Reserva', 'savings', true);
  end if;

  select id::text into v_primary_account_id from public.accounts where tenant_id = v_tenant_id and name = 'Conta Corrente Principal' limit 1;
  select id::text into v_savings_account_id from public.accounts where tenant_id = v_tenant_id and name = 'Conta Poupança Reserva' limit 1;

  if (select count(*) from public.fin_categories where tenant_id = v_tenant_id) = 0 then
    select exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'fin_categories' and column_name = 'type'
    ) into v_has_column;

    if v_has_column then
      insert into public.fin_categories (tenant_id, group_id, name, type, sort_order)
      values
        (v_tenant_id, null, 'Serviços', 'expense', 1),
        (v_tenant_id, null, 'Material de Escritório', 'expense', 2),
        (v_tenant_id, null, 'Assinaturas', 'expense', 3),
        (v_tenant_id, null, 'Receita de Serviços', 'revenue', 10),
        (v_tenant_id, null, 'Receita de Produtos', 'revenue', 11);
    else
      insert into public.fin_categories (tenant_id, group_id, name, sort_order)
      values
        (v_tenant_id, null, 'Serviços', 1),
        (v_tenant_id, null, 'Material de Escritório', 2),
        (v_tenant_id, null, 'Assinaturas', 3),
        (v_tenant_id, null, 'Receita de Serviços', 10),
        (v_tenant_id, null, 'Receita de Produtos', 11);
    end if;
  end if;

  select id::text into v_subscriptions_category_id from public.fin_categories where tenant_id = v_tenant_id and name = 'Assinaturas' limit 1;
  select id::text into v_office_category_id from public.fin_categories where tenant_id = v_tenant_id and name = 'Material de Escritório' limit 1;
  select id::text into v_services_revenue_category_id from public.fin_categories where tenant_id = v_tenant_id and name = 'Receita de Serviços' limit 1;

  if (select count(*) from public.transactions where tenant_id = v_tenant_id) = 0 then
    select exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'transactions' and column_name = 'type'
    ) into v_has_column;

    if v_has_column then
      execute format(
        'insert into public.transactions (tenant_id, account_id, category_id, payee_id, type, amount, date, description)
         values (%L, %L, %L, null, ''expense'', 299.00, current_date - 3, ''Pagamento de assinatura mensal''),
                (%L, %L, %L, null, ''expense'', 157.50, current_date - 2, ''Compra de material escritório''),
                (%L, %L, %L, null, ''income'', 5000.00, current_date - 1, ''Recebimento de serviço''),
                (%L, %L, null, null, ''transfer'', 2000.00, current_date, ''Transferência entre contas'')',
        v_tenant_id, v_primary_account_id, v_subscriptions_category_id,
        v_tenant_id, v_primary_account_id, v_office_category_id,
        v_tenant_id, v_primary_account_id, v_services_revenue_category_id,
        v_tenant_id, v_savings_account_id
      );
    else
      execute format(
        'insert into public.transactions (tenant_id, account_id, category_id, payee_id, amount, date, notes)
         values (%L, %L, %L, null, -29900, current_date - 3, ''Pagamento de assinatura mensal''),
                (%L, %L, %L, null, -15750, current_date - 2, ''Compra de material escritório''),
                (%L, %L, %L, null, 500000, current_date - 1, ''Recebimento de serviço''),
                (%L, %L, null, null, 200000, current_date, ''Transferência entre contas'')',
        v_tenant_id, v_primary_account_id, v_subscriptions_category_id,
        v_tenant_id, v_primary_account_id, v_office_category_id,
        v_tenant_id, v_primary_account_id, v_services_revenue_category_id,
        v_tenant_id, v_savings_account_id
      );
    end if;
  end if;

  if (select count(*) from public.tasks where tenant_id = v_tenant_id) = 0 then
    select exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'tasks' and column_name = 'column_id'
    ) into v_has_column;

    if v_has_column then
      execute format(
        'insert into public.tasks (tenant_id, title, status, column_id, assigned_to, priority, completed_at, tags, description)
         values (%L, ''Implementar layout do dashboard'', ''done'', %L, %L, ''high'', now() - interval ''5 days'', array[''demo''], ''Seed demo Fase B''),
                (%L, ''Configurar integração com Telegram'', ''done'', %L, %L, ''medium'', now() - interval ''3 days'', array[''demo''], ''Seed demo Fase B''),
                (%L, ''Onboarding do usuário tester'', ''done'', %L, %L, ''high'', now() - interval ''1 day'', array[''demo''], ''Seed demo Fase B'')',
        v_tenant_id, v_col_id, v_user_id,
        v_tenant_id, v_col_id, v_user_id,
        v_tenant_id, v_col_id, v_user_id
      );
    else
      insert into public.tasks (tenant_id, title, status, priority, completed_at, owner, progress, tags, category)
      values
        (v_tenant_id, 'Implementar layout do dashboard', 'Concluído', 'Alta', now() - interval '5 days', 'Equipe Central', 100, array['demo'], 'Operacional'),
        (v_tenant_id, 'Configurar integração com Telegram', 'Concluído', 'Média', now() - interval '3 days', 'Equipe Central', 100, array['demo'], 'Operacional'),
        (v_tenant_id, 'Onboarding do usuário tester', 'Concluído', 'Alta', now() - interval '1 day', 'Equipe Central', 100, array['demo'], 'Operacional');
    end if;
  end if;
end $$;
