import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { parseSlash } from './slash.ts'

Deno.test('parse /tarefa', () => {
  assertEquals(parseSlash('/tarefa comprar ração'), {
    action: 'tasks.create',
    params: { title: 'comprar ração' },
  })
})

Deno.test('parse /tarefas', () => {
  assertEquals(parseSlash('/tarefas'), { action: 'tasks.list', params: {} })
})

Deno.test('parse /ok', () => {
  assertEquals(parseSlash('/ok 3'), { action: 'tasks.complete', params: { num: 3 } })
})

Deno.test('parse /prioridade', () => {
  assertEquals(parseSlash('/prioridade 2 alta'), {
    action: 'tasks.setPriority',
    params: { num: 2, priority: 'Alta' },
  })
})

Deno.test('parse /nota', () => {
  assertEquals(parseSlash('/nota liguei pro cliente'), {
    action: 'activities.log',
    params: { type: 'note', text: 'liguei pro cliente' },
  })
})

Deno.test('parse /reuniao with accent', () => {
  const result = parseSlash('/reunião 14h equipe')
  assertEquals(result?.action, 'activities.log')
  assertEquals(result?.params.type, 'meeting')
})

Deno.test('parse /pagar', () => {
  assertEquals(parseSlash('/pagar conta de luz 150'), {
    action: 'finance.record',
    params: { direction: 'out', description: 'conta de luz', amount: 150 },
  })
})

Deno.test('parse /pagar with comma decimal', () => {
  assertEquals(parseSlash('/pagar almoço 32,50'), {
    action: 'finance.record',
    params: { direction: 'out', description: 'almoço', amount: 32.5 },
  })
})

Deno.test('parse /recebi', () => {
  assertEquals(parseSlash('/recebi salário 3000'), {
    action: 'finance.record',
    params: { direction: 'in', description: 'salário', amount: 3000 },
  })
})

Deno.test('parse /saldo', () => {
  assertEquals(parseSlash('/saldo'), { action: 'finance.balance', params: {} })
})

Deno.test('returns null for non-slash message', () => {
  assertEquals(parseSlash('texto livre aqui'), null)
})

Deno.test('returns null for unknown command', () => {
  assertEquals(parseSlash('/desconhecido'), null)
})
