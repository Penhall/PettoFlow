const MOJIBAKE_PATTERNS = [
  /\u00c3[\u0080-\u00bf]/,
  /\u00c2[\u0080-\u00bf]/,
  /\uFFFD/,
  /N\u00c3\u00a3o|poss\u00c3|espa\u00c3|inicializa\u00c3|configura\u00c3|padr\u00c3|a\u00c3\u00a7|usu\u00c3|m\u00c3\u00b3dulo/,
]

export function hasMojibake(value) {
  return MOJIBAKE_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))
}

export function assertEncodingSafe(value, label = 'content') {
  if (hasMojibake(value)) {
    throw new Error(`Mojibake detected in ${label}.`)
  }
  return value
}

export function collectMojibakeEntries(record, path = []) {
  if (typeof record === 'string') {
    return hasMojibake(record) ? [{ path: path.join('.'), value: record }] : []
  }

  if (!record || typeof record !== 'object') return []

  return Object.entries(record).flatMap(([key, value]) => (
    collectMojibakeEntries(value, [...path, key])
  ))
}
