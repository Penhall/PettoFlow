# Fase 21 - Onboarding Panel And Tour Report

## Nome da fase

Fase 21 - Painel inicial, tour curto e central de tutoriais

## Objetivo

Transformar a fundação invisível do onboarding em uma experiência inicial guiada, elegante e retomável:

- painel inicial no dashboard
- tour curto e não bloqueante
- central de tutoriais integrada ao shell
- reentrada por menu de perfil e navegação lateral

## Arquivos criados

- [src/components/onboarding/OnboardingPanel.jsx](/E:/PROJETOS/PettoFlow/src/components/onboarding/OnboardingPanel.jsx)
- [src/components/onboarding/OnboardingTour.jsx](/E:/PROJETOS/PettoFlow/src/components/onboarding/OnboardingTour.jsx)
- [src/components/onboarding/TutorialsHub.jsx](/E:/PROJETOS/PettoFlow/src/components/onboarding/TutorialsHub.jsx)
- [src/components/onboarding/TutorialCard.jsx](/E:/PROJETOS/PettoFlow/src/components/onboarding/TutorialCard.jsx)
- [src/components/onboarding/ContextualHint.jsx](/E:/PROJETOS/PettoFlow/src/components/onboarding/ContextualHint.jsx)
- [src/components/onboarding/OnboardingPanel.test.jsx](/E:/PROJETOS/PettoFlow/src/components/onboarding/OnboardingPanel.test.jsx)
- [src/components/onboarding/TutorialsHub.test.jsx](/E:/PROJETOS/PettoFlow/src/components/onboarding/TutorialsHub.test.jsx)

## Arquivos alterados

- [src/App.jsx](/E:/PROJETOS/PettoFlow/src/App.jsx)
- [src/components/Dashboard/Dashboard.jsx](/E:/PROJETOS/PettoFlow/src/components/Dashboard/Dashboard.jsx)
- [src/components/shell/SidebarRail.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/SidebarRail.jsx)
- [src/components/shell/ProfileMenu.jsx](/E:/PROJETOS/PettoFlow/src/components/shell/ProfileMenu.jsx)
- [src/index.css](/E:/PROJETOS/PettoFlow/src/index.css)

## Decisões técnicas

- O `App` passou a carregar `useOnboarding` no nível do shell e a orquestrar rota, painel, tutorial hub e tour.
- O tour usa estado persistido, mas permanece desacoplado do fluxo principal do produto.
- A central de tutoriais é uma rota lazy (`tutoriais`), preservando o modelo de chunk splitting já introduzido nas fases anteriores.
- O dashboard recebeu um slot explícito para o painel de onboarding, evitando duplicação de lógica de layout.

## Decisões de UX/UI

- O painel inicial aparece apenas quando ainda há checklist a concluir e pode ser dispensado.
- O tour é curto, calmamente guiado e reabrível pelo perfil, sem bloquear navegação real.
- A central de tutoriais segue o padrão premium do produto: `PageHeader`, `PageActionBar`, filtros de categoria e cards densos.
- O shell ganhou uma entrada de `Tutoriais` sem inflar a navegação principal.

## Riscos encontrados

- O tour depende da qualidade da copy e da ordem dos passos; ele ainda não é contextual por feature.
- O dashboard passou a receber mais responsabilidade visual, exigindo cuidado em futuras mudanças para não voltar a ficar congestionado.

## Pendências

- Ligar tutoriais e quick actions aos empty states operacionais.
- Introduzir hints persistentes nas áreas em que não há empty state completo.

## Próximos passos sugeridos

1. Conectar quick actions a `Tasks`, `Finance`, `Clientes` e áreas correlatas.
2. Persistir dismiss state de hints adicionais nas páginas.
3. Expandir o uso da central de tutoriais para contextos reais de ativação.

## Evidências de validação

- Painel e central de tutoriais cobertos por testes focados.
- Lint passando após integração com shell e dashboard.
- Build passando com a nova rota lazy de tutoriais.

## Comandos executados

- `npx.cmd vitest run src/components/onboarding/OnboardingPanel.test.jsx src/components/onboarding/TutorialsHub.test.jsx`
- `npm.cmd run lint`
- `npm.cmd run build`

## Resultado de build/test/lint

- `vitest`: passou nos testes focados de painel e tutorial hub
- `lint`: passou
- `build`: passou

## Commit da fase

- `0a00814` `feat(onboarding): add panel tour and tutorials hub`
