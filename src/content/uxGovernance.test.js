import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ACTION_TEXT,
  ADMIN_TEXT,
  EMPTY_STATE_TEXT,
  ERROR_MESSAGE_BY_CODE,
  ERROR_TEXT,
  LOADING_TEXT,
  PRODUCT,
  SETTINGS_TEXT,
  SHELL_TEXT,
} from './uxText.js'
import { collectMojibakeEntries, hasMojibake } from './encoding.js'
import { hasRawErrorLeak, normalizeError } from '../lib/mutationResult.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const ACTIVE_SOURCE_DIRS = ['src', 'supabase/functions']
const TEXT_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.html'])

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '__screenshots__'].includes(entry.name)) return []
      return walkFiles(fullPath)
    }
    return TEXT_EXTENSIONS.has(path.extname(entry.name)) ? [fullPath] : []
  })
}

describe('UX content governance', () => {
  it('keeps governed UX copy encoding-safe', () => {
    const entries = collectMojibakeEntries({
      ACTION_TEXT,
      ADMIN_TEXT,
      EMPTY_STATE_TEXT,
      ERROR_MESSAGE_BY_CODE,
      ERROR_TEXT,
      LOADING_TEXT,
      PRODUCT,
      SETTINGS_TEXT,
      SHELL_TEXT,
    })

    expect(entries).toEqual([])
  })

  it('detects mojibake and keeps active source files clean', () => {
    expect(hasMojibake('N\u00c3\u00a3o foi poss\u00c3\u00advel carregar')).toBe(true)
    expect(hasMojibake('Não foi possível carregar')).toBe(false)

    const findings = ACTIVE_SOURCE_DIRS.flatMap((dir) => walkFiles(path.join(ROOT, dir)))
      .flatMap((filePath) => {
        const content = fs.readFileSync(filePath, 'utf8')
        return hasMojibake(content) ? [path.relative(ROOT, filePath)] : []
      })

    expect(findings).toEqual([])
  })

  it('defines one retry/loading vocabulary for shell and error surfaces', () => {
    expect(ACTION_TEXT.retry).toBe('Tentar novamente')
    expect(ACTION_TEXT.reloadPage).toBe('Recarregar página')
    expect(LOADING_TEXT.area).toBe('Carregando área...')
    expect(EMPTY_STATE_TEXT.workspaceBootstrap.title).toBe('Não foi possível carregar o espaço de trabalho')
    expect(SETTINGS_TEXT.tabs[0].label).toBe('Espaço de trabalho')
  })

  it('normalizes raw provider errors into safe user-facing messages', () => {
    const normalized = normalizeError(
      Object.assign(new Error('Supabase fetch failed: violates foreign key constraint'), { code: '23503' }),
      { operation: 'workspace.bootstrap' },
    )

    expect(normalized.message).toBe(ERROR_MESSAGE_BY_CODE.persistence_failed)
    expect(hasRawErrorLeak(normalized.message)).toBe(false)
    expect(normalized.diagnostics.rawMessage).toContain('Supabase fetch failed')
  })
})
