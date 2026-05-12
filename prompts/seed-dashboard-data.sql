-- Seed data for workspace 'Central' (a4701ffa-91b2-42af-bdfa-e8f8d35bc318)
-- Creates columns, team members, clients, and tasks so the dashboard has data.

-- 1) Kanban columns
INSERT INTO kanban_columns (name, order_index, tenant_id, created_by_system)
VALUES
  ('A Fazer',    1, 'a4701ffa-91b2-42af-bdfa-e8f8d35bc318', true),
  ('Em Progresso', 2, 'a4701ffa-91b2-42af-bdfa-e8f8d35bc318', true),
  ('Concluído',   3, 'a4701ffa-91b2-42af-bdfa-e8f8d35bc318', true)
ON CONFLICT DO NOTHING;

-- 2) Team members
INSERT INTO team (name, role, email, tenant_id)
VALUES
  ('Ana Oliveira',   'Designer',   'ana@central.com',    'a4701ffa-91b2-42af-bdfa-e8f8d35bc318'),
  ('Carlos Santos',  'Dev Front',  'carlos@central.com', 'a4701ffa-91b2-42af-bdfa-e8f8d35bc318'),
  ('Marina Costa',   'PM',         'marina@central.com', 'a4701ffa-91b2-42af-bdfa-e8f8d35bc318'),
  ('Rafael Lima',    'Dev Backend','rafael@central.com', 'a4701ffa-91b2-42af-bdfa-e8f8d35bc318')
ON CONFLICT DO NOTHING;

-- 3) Clients
INSERT INTO clients (name, industry, status, email, phone, tenant_id)
VALUES
  ('TechNova Ltda',       'Tecnologia',   'Ativo',  'contato@technova.com',   '(11) 99999-0001', 'a4701ffa-91b2-42af-bdfa-e8f8d35bc318'),
  ('Mercearia do Porto',  'Varejo',       'Ativo',  'porto@mercado.com',      '(11) 99999-0002', 'a4701ffa-91b2-42af-bdfa-e8f8d35bc318'),
  ('Clínica Vita',        'Saúde',        'Ativo',  'admin@clinicavita.com',  '(11) 99999-0003', 'a4701ffa-91b2-42af-bdfa-e8f8d35bc318'),
  ('Construtora Nova Era','Construção',   'Prospecção','novaera@const.com',   '(11) 99999-0004', 'a4701ffa-91b2-42af-bdfa-e8f8d35bc318'),
  ('Studio Z Design',     'Design',       'Ativo',  'ola@studioz.design',    '(11) 99999-0005', 'a4701ffa-91b2-42af-bdfa-e8f8d35bc318'),
  ('Educa+ Plataforma',   'Educação',     'Prospecção','parceria@educamais.com','(11) 99999-0006', 'a4701ffa-91b2-42af-bdfa-e8f8d35bc318')
ON CONFLICT DO NOTHING;

-- 4) Tasks (15 tasks across all columns, with tags, progress, deal values)
INSERT INTO tasks (title, status, priority, progress, tags, owner, client_id, deal_value, tenant_id, created_by_system, created_at)
VALUES
  -- A Fazer (5 tasks)
  ('Landing page TechNova',             'A Fazer', 'Alta',    0,   ARRAY['design','frontend'],       'Ana Oliveira',   1,  15000, 'a4701ffa-91b2-42af-bdfa-e8f8d35bc318', true, NOW() - INTERVAL '5 days'),
  ('Integração gateway pagamento',      'A Fazer', 'Alta',    0,   ARRAY['backend','integração'],     'Rafael Lima',    1,  8000,  'a4701ffa-91b2-42af-bdfa-e8f8d35bc318', true, NOW() - INTERVAL '4 days'),
  ('Migração servidor Clínica Vita',    'A Fazer', 'Média',   0,   ARRAY['devops','infra'],          'Rafael Lima',    3,  22000, 'a4701ffa-91b2-42af-bdfa-e8f8d35bc318', true, NOW() - INTERVAL '3 days'),
  ('Identidade visual Studio Z',        'A Fazer', 'Média',   0,   ARRAY['design','branding'],       'Ana Oliveira',   5,  12000, 'a4701ffa-91b2-42af-bdfa-e8f8d35bc318', true, NOW() - INTERVAL '3 days'),
  ('Proposta comercial Educa+',         'A Fazer', 'Baixa',   0,   ARRAY['comercial','proposta'],     'Marina Costa',   6,  45000, 'a4701ffa-91b2-42af-bdfa-e8f8d35bc318', true, NOW() - INTERVAL '2 days'),

  -- Em Progresso (6 tasks)
  ('Dashboard admin TechNova',          'Em Progresso', 'Alta',  35,  ARRAY['frontend','dashboard'],    'Carlos Santos',  1,  18000, 'a4701ffa-91b2-42af-bdfa-e8f8d35bc318', true, NOW() - INTERVAL '7 days'),
  ('API de agendamentos',               'Em Progresso', 'Alta',  60,  ARRAY['backend','api'],           'Rafael Lima',    3,  9500,  'a4701ffa-91b2-42af-bdfa-e8f8d35bc318', true, NOW() - INTERVAL '6 days'),
  ('Relatório mensal Q2',               'Em Progresso', 'Média', 45,  ARRAY['analytics','relatório'],   'Marina Costa',   NULL, 0,     'a4701ffa-91b2-42af-bdfa-e8f8d35bc318', true, NOW() - INTERVAL '5 days'),
  ('Catálogo digital Mercearia',        'Em Progresso', 'Média', 20,  ARRAY['frontend','ecommerce'],    'Carlos Santos',  2,  7500,  'a4701ffa-91b2-42af-bdfa-e8f8d35bc318', true, NOW() - INTERVAL '4 days'),
  ('Sistema de notificações',           'Em Progresso', 'Alta',  70,  ARRAY['backend','push'],          'Rafael Lima',    NULL, 6000,  'a4701ffa-91b2-42af-bdfa-e8f8d35bc318', true, NOW() - INTERVAL '4 days'),
  ('Página de casos de sucesso',        'Em Progresso', 'Baixa', 15,  ARRAY['design','conteúdo'],       'Ana Oliveira',   5,  3000,  'a4701ffa-91b2-42af-bdfa-e8f8d35bc318', true, NOW() - INTERVAL '2 days'),

  -- Concluído (4 tasks)
  ('MVP plataforma cursos',             'Concluído', 'Alta',   100, ARRAY['fullstack','produto'],      'Carlos Santos',  6,  35000, 'a4701ffa-91b2-42af-bdfa-e8f8d35bc318', true, NOW() - INTERVAL '14 days'),
  ('Wireframe app Clínica Vita',        'Concluído', 'Média',  100, ARRAY['design','ux'],             'Ana Oliveira',   3,  5000,  'a4701ffa-91b2-42af-bdfa-e8f8d35bc318', true, NOW() - INTERVAL '10 days'),
  ('Auditoria segurança infra',         'Concluído', 'Alta',   100, ARRAY['infra','segurança'],       'Rafael Lima',    1,  12000, 'a4701ffa-91b2-42af-bdfa-e8f8d35bc318', true, NOW() - INTERVAL '8 days'),
  ('Site institucional Construtora',    'Concluído', 'Baixa',  100, ARRAY['frontend','site'],          'Carlos Santos',  4,  9000,  'a4701ffa-91b2-42af-bdfa-e8f8d35bc318', true, NOW() - INTERVAL '6 days')
ON CONFLICT DO NOTHING;
