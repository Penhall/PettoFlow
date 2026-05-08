# PettoFlow Onboarding, Tour Inicial e Central de Tutoriais Design

## Summary

Esta fase adiciona uma experiencia de primeiro uso guiada ao PettoFlow para reduzir o efeito de produto vazio, melhorar a percepcao de valor e aumentar a ativacao inicial de novos tenants.

O desenho aprovado e:

- onboarding continuo, sem wizard bloqueante
- tenant novo nasce com dados iniciais persistidos e totalmente editaveis
- checklist operacional como eixo principal da ativacao
- tour curto, contextual, pulavel e retomavel
- central de tutoriais como pagina propria, integrada ao progresso
- empty states inteligentes conectados a ajuda e a acoes reais do produto

## Goals

- eliminar a sensacao de telas vazias no primeiro acesso
- entregar um tenant novo ja utilizavel e compreensivel
- orientar o usuario sobre o que fazer primeiro sem bloquear exploracao
- criar uma trilha clara entre onboarding, empty states e ajuda interna
- centralizar documentacao funcional do produto em uma area navegavel
- preservar a identidade premium e densa da interface atual

## Non-goals

- nao transformar o produto em um wizard linear de setup
- nao criar conteudo demo generico ou cenografico desconectado do SaaS
- nao introduzir um CMS externo para tutoriais nesta fase
- nao congelar registros seeded como dados protegidos
- nao expandir para um sistema de analytics avancado de ativacao nesta etapa

## Product problem

O PettoFlow esta perto da fase de testes com usuarios reais, mas o tenant novo ainda corre risco de parecer vazio ou frio. Isso afeta:

- entendimento do que cada modulo faz
- velocidade de ativacao
- confianca no produto
- percepcao de maturidade

Mesmo com a interface premium consolidada, faltam mecanismos de orientacao progressiva apos login e selecao do tenant.

## Approved experience model

### 1. Seed inicial do tenant

Todo tenant novo deve nascer com uma base inicial editavel e apagavel desde o primeiro minuto.

Esse seed nao e um ambiente demo generico. Ele e parte do onboarding do proprio PettoFlow.

O seed inclui:

- tarefas de configuracao inicial
- clientes institucionais do PettoFlow
- atividades e lembretes iniciais ligados ao onboarding
- elementos financeiros ligados a assinatura do servico
- conteudo de ajuda e proximos passos coerentes com essas entidades

### 2. Onboarding continuo

Em vez de travar o usuario num fluxo linear, o produto exibe um painel de onboarding com etapas claras e acionaveis.

O painel representa progresso real e deve ajudar o usuario a:

- entender o produto
- completar configuracoes iniciais
- substituir os exemplos por dados reais
- descobrir a central de tutoriais

### 3. Tour contextual

O tour nao e a experiencia principal. Ele serve para orientar os controles mais importantes do shell e das paginas centrais.

Regras:

- curto
- pulavel
- retomavel
- salvo por usuario e tenant
- modular, evitando uma sequencia longa demais

### 4. Central de tutoriais

O produto passa a ter uma area propria de tutoriais e documentacao interna, conectada ao onboarding e aos empty states.

Essa area nao e uma FAQ solta. Ela e uma superficie operacional do produto.

### Workspace initialization modes

O modelo de inicializacao do workspace precisa ser preparado para mais de um modo, mesmo que nesta fase apenas um deles seja ativado de forma padrao.

Modos previstos:

- guided_seeded
- clean_workspace
- future_demo_workspace
- future_imported_workspace

Diretrizes:

- `guided_seeded` e o padrao atual desta fase
- `clean_workspace` deve permitir uma experiencia sem exemplos no futuro
- `future_demo_workspace` fica reservado para cenarios de demonstracao ou vendas
- `future_imported_workspace` prepara compatibilidade com futuras entradas por importacao

Nesta fase, a exigencia e preparar a arquitetura e a compatibilidade futura, nao implementar todos os modos.

## Seed content

### Tasks

O tenant novo recebe tarefas de configuracao com titulos e textos operacionais, por exemplo:

- revisar o espaco de trabalho
- cadastrar o primeiro cliente real
- registrar a primeira atividade
- revisar equipe e acesso
- validar a estrutura financeira
- revisar a assinatura recorrente
- abrir a central de tutoriais

As tarefas podem apontar para areas reais do produto e devem ajudar a mover o usuario pelos modulos principais.

### Clients

Os clientes seeded representam a relacao do usuario com a empresa dona do SaaS. Eles devem ser claros e utilitarios, por exemplo:

- empresa dona do PettoFlow
- gerente de conta
- equipe de ajuda
- contato financeiro ou comercial

Esses registros precisam parecer plausiveis e uteis, nunca cenograficos.

### Activities

As atividades seeded devem reforcar a narrativa de onboarding sem parecer spam.

Exemplos:

- contato inicial de boas-vindas
- lembrete de ativacao
- follow-up para configurar o ambiente

### Finance

O seed financeiro deve refletir a relacao de assinatura com o PettoFlow, como:

- lancamento recorrente da assinatura
- conta principal ou categoria minima, se isso for necessario para coerencia do modulo

## Onboarding checklist

O onboarding deve ser representado por uma checklist persistida, por usuario e tenant.

Etapas iniciais recomendadas:

- concluir criacao do espaco
- entender navegacao principal
- cadastrar primeiro cliente real
- registrar primeira atividade real
- criar ou mover primeira tarefa real
- revisar assinatura e elementos financeiros
- visitar a central de tutoriais

Cada item da checklist precisa ter:

- id estavel
- titulo
- descricao curta
- criterio de conclusao
- CTA primario
- tutorial relacionado, quando aplicavel

## Tour model

O tour inicial deve cobrir apenas os pontos de maior valor:

- shell principal
- busca global
- painel de onboarding
- tarefas
- clientes
- financas
- central de tutoriais

Persistencia minima do tour:

- nao iniciado
- em progresso
- pulado
- concluido
- ultima etapa vista

O tour precisa ser reaberto manualmente pela interface.

## Empty-state strategy

Mesmo com seed inicial, o produto precisa continuar bom quando o usuario apagar os exemplos.

Todo empty state critico precisa explicar:

1. o que aquela area faz
2. por que ela esta vazia
3. qual acao deve acontecer em seguida

Cada vazio pode incluir:

- CTA para criar dado real
- CTA para abrir tutorial relacionado
- dica operacional curta

### Quick actions

Os empty states devem permitir acoes rapidas diretamente ligadas a ativacao inicial e ao uso real do produto.

Exemplos:

- `[Criar cliente]`
- `[Importar contatos]`
- `[Criar primeira tarefa]`
- `[Usar template]`
- `[Agendar atendimento]`

As quick actions devem reduzir a friccao entre onboarding, empty state e acao real do produto.

Prioridades:

- Tasks
- Activities
- Finance
- Clients
- Team
- Calendar
- Archive
- Settings de integracoes e comandos

## Tutorials hub

### Role in the product

A Central de Tutoriais e uma pagina propria do PettoFlow e faz parte do uso continuo do produto.

Ela deve oferecer:

- busca
- trilhas por modulo
- guias curtos e orientados a acao
- progresso por usuario e tenant
- links para abrir areas reais do app

### Tutorial taxonomy

Categorias iniciais:

- Primeiros passos
- Tarefas
- Atividades
- Clientes
- Financas
- Calendario
- Time
- Configuracoes
- Administracao, quando relevante

### Content model

Os tutoriais devem ser definidos como catalogo versionado no frontend, com ids estaveis e metadados estruturados.

Cada tutorial precisa ter:

- id
- titulo
- descricao
- categoria
- nivel ou contexto
- CTA de abertura
- relacao com itens de onboarding, se existir
- owner_module
- last_reviewed_at
- deprecated
- feature_dependency
- minimum_version

Os tutoriais precisam ter ownership claro, para evitar envelhecimento silencioso de conteudo.

Tambem precisam suportar dependencia de feature e de versao, para que o produto possa ocultar, depreciar ou adaptar conteudo conforme a evolucao da plataforma.

Nesta fase, persistimos no backend apenas o progresso do usuario. O conteudo em si permanece no frontend para simplicidade, governanca e versionamento.

### AI-ready onboarding metadata

Entidades de onboarding, tutorial, quick action e empty states devem possuir ids estaveis e relacoes explicitas entre si.

Isso prepara a arquitetura para:

- copiloto interno
- ajuda contextual
- onboarding adaptativo
- IA operacional

Nenhuma IA sera implementada agora. O objetivo desta fase e apenas preparar a estrutura para evolucao futura sem retrabalho conceitual.

## Data and persistence model

### Backend persistence

Persistir por usuario e tenant:

- progresso do tour
- progresso da checklist inicial
- progresso dos tutoriais

Persistir por tenant:

- seed inicial criado
- versao do seed, se necessario para evitar duplicacao

### Seed lifecycle

O seed deve ser aplicado automaticamente na criacao do tenant.

Requisitos:

- idempotencia defensiva
- criacao coerente entre tarefas, clientes, atividades e financas
- dados seeded claramente editaveis e deletaveis
- nao recriar exemplos sem intencao explicita do sistema

### Seed provenance

Todo registro criado automaticamente pelo sistema deve possuir metadata de origem.

Metadata minima sugerida:

- origin_type
- origin_version
- seed_batch_id
- created_by_system

Valores esperados para `origin_type`:

- system_seed
- onboarding_seed
- demo_seed
- user_created
- imported

Objetivos dessa estrategia:

- identificar dados criados automaticamente
- evitar duplicacoes
- suportar limpeza seletiva
- suportar analytics
- preparar futura IA contextual
- permitir migracao segura de seeds

Os dados continuam totalmente editaveis e deletaveis. A provenance nao deve travar entidades nem mudar a natureza operacional dos registros.

### Onboarding versioning

O modelo de onboarding deve ser versionado para suportar evolucao incremental do produto.

Campos conceituais minimos:

- current_onboarding_version
- completed_onboarding_version
- last_seen_onboarding_version

Isso permite:

- onboarding incremental
- novas experiencias futuras
- reabertura parcial de onboarding
- onboarding especifico por feature
- compatibilidade entre tenants antigos e novos

Tours, checklist e tutoriais podem evoluir por versao, sem exigir uma ruptura unica no modelo.

### Persistent dismiss state

O sistema deve persistir dismiss de elementos de ajuda e orientacao para nao se tornar repetitivo com usuarios mais maduros.

Escopos iniciais:

- onboarding panel
- contextual hints
- tutorial suggestions
- helper surfaces
- tours

Metadata sugerida:

- dismissed
- dismissed_at
- dismiss_scope
- dismiss_reason

O sistema nunca deve parecer insistente ou repetitivo para usuarios avancados.

## Progressive onboarding strategy

Ajuda, hints, tutoriais e sugestoes nao devem aparecer todos de uma vez. O sistema deve revelar funcionalidades progressivamente conforme uso real e maturidade do usuario.

Estagios possiveis:

- new
- learning
- operational
- advanced
- power_user

Conceitos de suporte:

- experience_level
- feature_exposure_stage

Recursos avancados podem aparecer apenas conforme a maturidade do usuario. O objetivo e evitar sobrecarga cognitiva e preservar clareza operacional.

## Activation telemetry

O onboarding precisa definir uma trilha minima de eventos para medir ativacao e orientar iteracoes futuras.

Eventos iniciais sugeridos:

- onboarding_started
- onboarding_completed
- tutorial_opened
- tutorial_completed
- tour_skipped
- tour_completed
- checklist_item_completed
- empty_state_cta_clicked
- quick_action_triggered

Objetivos:

- medir ativacao
- detectar abandono
- identificar modulos confusos
- entender uso dos tutoriais
- melhorar onboarding ao longo do tempo

A telemetry inicial pode ser simples e incremental. O objetivo desta fase nao e criar uma plataforma analitica complexa, e sim garantir observabilidade minima do comportamento de ativacao.

### Contextual re-engagement

O sistema pode, no futuro imediato, detectar onboarding incompleto ou baixa ativacao e oferecer retomadas discretas.

Exemplos:

- "Voce ainda nao criou seu primeiro cliente."
- "Precisa de ajuda para configurar essa area?"

Diretrizes:

- comportamento discreto
- cooldown
- anti-spam
- contexto real
- nunca invasivo

## Failure handling

O onboarding nunca pode bloquear acesso ao produto.

Precisamos cobrir, no minimo, cenarios como:

- seed falhou
- tutorial indisponivel
- tour corrompido
- persistencia falhou
- metadata inconsistente

Direcao tecnica:

- graceful degradation
- retries
- fallbacks
- logs
- recuperacao segura

## UX and UI rules

- o onboarding deve parecer parte do produto premium, nao um overlay de marketing
- nada de mascotes, gamificacao infantil ou celebracoes exageradas
- progresso e ajuda devem ser calmos e operacionais
- densidade visual deve seguir o sistema premium ja implantado
- o painel inicial precisa coexistir com o shell atual sem virar homepage inflada
- a central de tutoriais precisa usar o mesmo sistema de superficies, tipografia e motion do resto da app

## Architecture impact

### Domain layer

Adicionar uma camada clara para:

- seed do tenant novo
- leitura e gravacao do progresso de onboarding
- catalogo de tutoriais

### Shell layer

Adicionar entrada visivel para:

- painel de onboarding
- central de tutoriais
- reabrir tour

### Page layer

Conectar os empty states ao onboarding e aos tutoriais sem duplicar logica em cada modulo.

## Implementation phases

### Fase A - Fundacao

- modelo de progresso por usuario e tenant
- seed inicial de tenant
- catalogo de tutoriais

### Fase B - Painel e tour

- painel de onboarding continuo
- progresso real da checklist
- tour curto com persistencia

### Fase C - Empty states conectados

- revisao das areas criticas
- CTAs reais
- links para tutoriais e onboarding

### Fase D - Central de tutoriais

- pagina dedicada
- busca
- categorias
- progresso
- integracao com o shell

### Fase E - Hardening

- testes
- revisao de copy
- responsividade
- relatorios por fase em docs

## Success criteria

Esta fase so sera considerada completa se:

- o primeiro acesso nao parecer vazio
- o tenant novo abrir com contexto util e coerente
- o usuario entender rapidamente o que fazer primeiro
- os dados seeded puderem ser editados ou apagados sem friccao
- os empty states continuarem inteligentes mesmo apos limpeza manual
- a central de tutoriais for navegavel e util
- o tour for discreto e retomavel
- a experiencia se integrar ao sistema premium sem parecer um enxerto paralelo
- o onboarding esteja preparado para evolucao futura
- exista telemetry minima definida
- o onboarding seja progressivo em vez de ruidoso
- o dismiss persistente esteja previsto no modelo
- a governanca dos tutoriais esteja explicita
- a arquitetura esteja preparada para IA contextual futura
- o sistema suporte usuarios iniciantes e avancados
- a provenance dos dados seeded esteja definida

## Risks

- seed excessivo pode parecer poluicao se o volume inicial for alto demais
- seed fraco demais nao resolve a ativacao
- heuristicas automaticas de checklist podem ser ambiguas se nao houver persistencia clara
- empty states e tutoriais podem divergir se o catalogo nao tiver ids e ownership claros
- onboarding pode competir com o conteudo operacional se o painel inicial for grande demais
- excesso de hints pode gerar fadiga
- telemetry excessiva pode aumentar ruido
- onboarding mal versionado pode gerar inconsistencias
- quick actions mal conectadas podem gerar duplicidade de fluxo
- tutoriais sem ownership podem envelhecer rapidamente

## Recommended technical direction

- seed automatico persistido e editavel na criacao do tenant
- catalogo de tutoriais no frontend com ids estaveis
- progresso persistido no backend por usuario e tenant
- checklist como eixo principal
- tour como camada secundaria de orientacao
- onboarding versionado
- progressive disclosure
- telemetry incremental
- provenance rastreavel
- metadata preparada para IA
- dismiss persistente
- quick actions reutilizaveis
- relatorios por fase em `docs/PHASE_XX_ONBOARDING_TOUR_REPORT.md`
