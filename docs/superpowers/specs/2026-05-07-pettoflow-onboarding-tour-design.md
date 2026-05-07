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

Nesta fase, persistimos no backend apenas o progresso do usuario. O conteudo em si permanece no frontend para simplicidade, governanca e versionamento.

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

## Risks

- seed excessivo pode parecer poluicao se o volume inicial for alto demais
- seed fraco demais nao resolve a ativacao
- heuristicas automaticas de checklist podem ser ambiguas se nao houver persistencia clara
- empty states e tutoriais podem divergir se o catalogo nao tiver ids e ownership claros
- onboarding pode competir com o conteudo operacional se o painel inicial for grande demais

## Recommended technical direction

- seed automatico persistido e editavel na criacao do tenant
- catalogo de tutoriais no frontend com ids estaveis
- progresso persistido no backend por usuario e tenant
- checklist como eixo principal
- tour como camada secundaria de orientacao
- relatorios por fase em `docs/PHASE_XX_ONBOARDING_TOUR_REPORT.md`
