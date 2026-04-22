// supabase/functions/_shared/crypto.ts

const ALGORITHM = 'AES-GCM'

function getKey(rawKey: string): Promise<CryptoKey> {
  const keyBytes = new TextEncoder().encode(rawKey.padEnd(32, '0').slice(0, 32))
  return crypto.subtle.importKey('raw', keyBytes, { name: ALGORITHM }, false, [
    'encrypt',
    'decrypt',
  ])
}

export async function encrypt(plaintext: string, encryptionKey: string): Promise<string> {
  const key = await getKey(encryptionKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(plaintext)
  const encrypted = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, data)
  const ivB64 = btoa(String.fromCharCode(...iv))
  const encB64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)))
  return `${ivB64}:${encB64}`
}

export async function decrypt(ciphertext: string, encryptionKey: string): Promise<string> {
  try {
    const [ivB64, encB64] = ciphertext.split(':')
    if (!ivB64 || !encB64) throw new Error('Invalid ciphertext format')
    const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0))
    const encrypted = Uint8Array.from(atob(encB64), (c) => c.charCodeAt(0))
    const key = await getKey(encryptionKey)
    const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, encrypted)
    return new TextDecoder().decode(decrypted)
  } catch (err) {
    throw new Error(`Failed to decrypt value: ${err instanceof Error ? err.message : String(err)}`)
  }
}
