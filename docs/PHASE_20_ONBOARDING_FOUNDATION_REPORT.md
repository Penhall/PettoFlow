# Fase 20 - Onboarding Foundation Report

## Nome da fase

Fase 20 - Fundação de onboarding, seed inicial e domínio frontend

## Objetivo

Criar a base arquitetural do onboarding do PettoFlow sem bloquear o produto:

- persistência por `tenant + user`
- seed inicial editável
- provenance dos dados seeded
- versionamento do onboarding
- telemetry mínima
- catálogo versionado de tutoriais, checklist e quick actions
- hook consolidado de estado para o frontend

## Arquivos criados

- [supabase/migrations/20260507190000_onboarding_state_and_seed_metadata.sql](/E:/PROJETOS/PettoFlow/supabase/migrations/20260507190000_onboarding_state_and_seed_metadata.sql)
- [supabase/functions/_shared/onboarding.ts](/E:/PROJETOS/PettoFlow/supabase/functions/_shared/onboarding.ts)
- [src/lib/onboardingState.js](/E:/PROJETOS/PettoFlow/src/lib/onboardingState.js)
- [src/lib/onboardingApi.js](/E:/PROJETOS/PettoFlow/src/lib/onboardingApi.js)
- [src/lib/tutorialCatalog.js](/E:/PROJETOS/PettoFlow/src/lib/tutorialCatalog.js)
- [src/hooks/useOnboarding.js](/E:/PROJETOS/PettoFlow/src/hooks/useOnboarding.js)
- [src/hooks/useOnboarding.test.jsx](/E:/PROJETOS/PettoFlow/src/hooks/useOnboarding.test.jsx)

## Arquivos alterados

- [supabase/functions/tenant-core/index.ts](/E:/PROJETOS/PettoFlow/supabase/functions/tenant-core/index.ts)
- [src/lib/tutorialCatalog.test.js](/E:/PROJETOS/PettoFlow/src/lib/tutorialCatalog.test.js)

## Decisões técnicas

- O estado de onboarding foi separado de `tenant_settings` em tabelas próprias para evitar acoplamento excessivo e facilitar versionamento.
- Os eventos mínimos de onboarding foram registrados em `tenant_onboarding_events`, suficientes para ativação incremental sem criar um sistema analítico paralelo.
- O seed inicial foi implementado como idempotente, com metadata de provenance e proteção contra duplicação parcial.
- O frontend passou a consumir onboarding via `onboardingApi.js` e `useOnboarding.js`, mantendo fallback seguro quando a API falha.
- O catálogo de tutoriais foi tratado como código versionado, com ids estáveis e metadata pronta para governança futura.

## Decisões de UX/UI

- O modo padrão permanece `guided_seeded`, mas os dados seeded continuam totalmente editáveis e apagáveis.
- Os exemplos iniciais representam a relação do cliente com a empresa dona do SaaS, não dados genéricos fictícios.
- O onboarding não vira wizard bloqueante; ele passa a ser infraestrutura para ajuda progressiva.

## Riscos encontrados

- Divergências futuras entre schema real e catálogos seeded podem gerar inconsistências se novas entidades forem adicionadas sem metadata de provenance.
- A telemetry ainda é propositalmente mínima e não cobre analytics agregados.
- O modo `guided_seeded` está implementado em runtime; os demais modos ficaram preparados apenas na arquitetura.

## Pendências

- Integrar o estado de onboarding ao shell e às páginas.
- Criar painel visível, tour curto e central de tutoriais.
- Ligar quick actions às superfícies reais do produto.

## Próximos passos sugeridos

1. Integrar o hook no `App` com uma rota de tutoriais e um painel de ativação.
2. Adicionar tour retomável com persistência de progresso.
3. Conectar tutoriais e quick actions aos empty states das páginas críticas.

## Evidências de validação

- Contrato inicial de versão e catálogo validado por teste.
- Hook de onboarding carregando estado do tenant com sucesso.
- Lint e build passando após a introdução da base arquitetural.

## Comandos executados

- `npx.cmd vitest run src/lib/tutorialCatalog.test.js`
- `npx.cmd vitest run src/lib/tutorialCatalog.test.js src/hooks/useOnboarding.test.jsx`
- `npm.cmd run lint`
- `npm.cmd run build`

## Resultado de build/test/lint

- `vitest`: passou nos testes focados da fundação
- `lint`: passou
- `build`: passou

## Commits da fase

- `cd8107c` `feat(onboarding): add backend onboarding foundation`
- `c2636a6` `feat(onboarding): add frontend onboarding domain`
