# Revisão: Auditoria de ProtectedRoute flicker

## Contexto

Revise o prompt de auditoria em `prompts/audit-auth-loading-flicker.md` e o código afetado no repositório `/root/PettoFlow`.

## Sua tarefa

1. Leia o prompt de auditoria (`prompts/audit-auth-loading-flicker.md`)
2. Leia os arquivos mencionados (src/lib/lazyWithRetry.js, src/App.jsx, src/RootRouter.jsx, src/components/auth/ProtectedRoute.jsx, src/context/AuthContext.jsx, src/context/TenantContext.jsx, src/components/shell/Topbar.jsx)
3. Valide cada hipótese — qual é a causa raiz MAIS PROVÁVEL?
4. Aponte:
   - Erros de lógica (ex: ref que nunca é lido, race conditions)
   - Problemas de arquitetura (ex: lazyWithRetry causando page reload)
   - Gaps na implementação atual
   - Sugestões de correção PRIORIZADAS por impacto

## Formato da resposta

```markdown
## Diagnóstico
[Causa raiz identificada]

## Evidências
[Linhas de código que comprovam]

## Correções sugeridas (priorizadas)
1. [Alta] [Descrição + arquivo + linhas]
2. [Média] ...
3. [Baixa] ...

## Riscos de cada correção
[O que pode quebrar se a correção for mal implementada]
```

## Lembrete

Seu papel é REVISOR, não implementador. Aponte problemas, não escreva código (a menos que seja essencial para demonstrar um ponto).
