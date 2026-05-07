import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const GOVERNED_PATHS = [
  'src/App.jsx',
  'src/components/shell',
  'src/components/shared',
  'src/components/Dashboard',
  'src/components/Team',
  'src/components/Clients',
  'src/components/Calendar',
  'src/components/Settings/SettingsView.jsx',
]

function listFiles(targetPath) {
  const absolutePath = path.join(ROOT, targetPath)
  const stats = fs.statSync(absolutePath)

  if (stats.isFile()) {
    return [absolutePath]
  }

  return fs.readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(absolutePath, entry.name)
    if (entry.isDirectory()) return listFiles(path.relative(ROOT, entryPath))
    return entryPath
  })
}

function isGovernedSourceFile(filePath) {
  return /\.(jsx|js)$/.test(filePath) && !filePath.endsWith('.test.jsx') && !filePath.endsWith('.test.js')
}

const governedFiles = GOVERNED_PATHS.flatMap(listFiles).filter(isGovernedSourceFile)

describe('design system governance', () => {
  it('documents the frozen ruleset', () => {
    expect(fs.existsSync(path.join(ROOT, 'DESIGN_SYSTEM_RULES.md'))).toBe(true)
  })

  it('avoids inline structural styles in governed premium surfaces', () => {
    const offenders = governedFiles.filter((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8')
      const inlineStyles = [...source.matchAll(/style=\{\{([\s\S]*?)\}\}/g)]
      return inlineStyles.some((match) => !match[1].trim().startsWith("'--") && !match[1].trim().startsWith('"--'))
    })

    expect(offenders).toEqual([])
  })

  it('avoids local transition timing literals in governed premium surfaces', () => {
    const offenders = governedFiles.filter((filePath) =>
      /transition=\{\{\s*duration\s*:/.test(fs.readFileSync(filePath, 'utf8'))
    )

    expect(offenders).toEqual([])
  })
})
