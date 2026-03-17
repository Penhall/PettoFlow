// src/lib/finUtils.js

// Converte centavos (integer) para string formatada em BRL
// Ex: centsToReal(150000) → "R$ 1.500,00"
// Ex: centsToReal(-5050) → "-R$ 50,50"
export function centsToReal(cents) {
  if (cents == null || isNaN(cents)) return 'R$ 0,00'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Converte string de valor real para centavos (integer)
// Suporta: "1.500,00", "1500.00", "1500", "-150,00"
// Retorna 0 para entradas inválidas (null, undefined, NaN)
export function realToCents(str) {
  if (str == null || str === '') return 0
  const cleaned = String(str)
    .replace(/[R$\s]/g, '')   // remove símbolo e espaços
    .replace(/\./g, '')        // remove separador de milhar (ponto BR)
    .replace(',', '.')         // converte vírgula decimal em ponto
  const n = parseFloat(cleaned)
  if (isNaN(n)) return 0
  return Math.round(n * 100)
}
