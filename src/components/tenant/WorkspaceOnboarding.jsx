import { useEffect, useState } from 'react'
import { useTenant } from '../../hooks/useTenant.js'

function slugifyWorkspaceName(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function WorkspaceOnboarding() {
  const { createWorkspace } = useTenant()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugifyWorkspaceName(name))
    }
  }, [name, slugTouched])

  async function handleSubmit(event) {
    event.preventDefault()
    const trimmedName = name.trim()
    const normalizedSlug = slugifyWorkspaceName(slug)

    if (!trimmedName) {
      setError('Informe o nome do workspace.')
      return
    }

    if (!normalizedSlug) {
      setError('Informe um slug valido para o workspace.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await createWorkspace({ name: trimmedName, slug: normalizedSlug })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Nao foi possivel criar o workspace.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="workspace-onboarding-title">
        <div className="auth-copy">
          <span className="auth-eyebrow">NexusCRM</span>
          <h1 id="workspace-onboarding-title">Criar seu workspace</h1>
          <p>Organize clientes, tarefas, atividades e financas em um unico workspace.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="workspace-name">Nome do workspace</label>
          <input
            id="workspace-name"
            name="workspace-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Equipe Comercial"
            autoComplete="organization"
          />

          <label htmlFor="workspace-slug">Slug do workspace</label>
          <input
            id="workspace-slug"
            name="workspace-slug"
            type="text"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true)
              setSlug(event.target.value)
            }}
            placeholder="equipe-comercial"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
          />

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Criando workspace...' : 'Criar workspace'}
          </button>
        </form>
      </section>
    </main>
  )
}
