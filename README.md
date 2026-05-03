# NexusCRM

NexusCRM e uma plataforma de CRM operacional para pequenas equipes. A aplicacao reune gestao de clientes, tarefas, atividades, calendario, financas, recebiveis e integracao com Telegram em uma interface unica.

## Visao geral

O projeto atual esta evoluindo de uma base funcional existente para um core SaaS mais seguro e multi-tenant. O nome visivel ao usuario deve ser tratado como `NexusCRM`.

## Stack atual

- React 18 + Vite
- Supabase (PostgreSQL + Edge Functions + Auth)
- CSS puro
- Vitest para testes de frontend

## Rodando localmente

1. Instale dependencias:

```bash
npm install
```

2. Configure o `.env` com apenas as variaveis publicas do frontend:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

O acesso nao depende mais de segredo compartilhado no frontend. O app exige sessao real via Supabase Auth.

3. Inicie o frontend:

```bash
npm run dev
```

4. Rode os testes:

```bash
npm test
```

5. Gere o build:

```bash
npm run build
```

## Documentacao adicional

- Documentacao tecnica: `DOCS.md`
- Diagnostico SaaS inicial: `docs/PHASE_0_DIAGNOSTICO_SAAS.md`
- Diagnostico de auth da Fase 2: `docs/PHASE_2_AUTH_DIAGNOSTICO.md`
