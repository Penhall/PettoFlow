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

export default function WorkspaceOnboarding({ embed = false }) {
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
      setError('Informe o nome do espaço de trabalho.')
      return
    }

    if (!normalizedSlug) {
      setError('Informe um slug válido para o espaço de trabalho.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await createWorkspace({ name: trimmedName, slug: normalizedSlug })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível criar o espaço de trabalho.')
    } finally {
      setLoading(false)
    }
  }

  if (embed) {
    return (
      <div className="workspace-onboarding-embed">
        <div className="workspace-onboarding-embed__copy">
          <h2>Criar seu espaço de trabalho</h2>
          <p>Organize clientes, tarefas, atividades e finanças em um único espaço de trabalho.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="workspace-name">Nome do espaço de trabalho</label>
          <input
            id="workspace-name"
            name="workspace-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Equipe Comercial"
            autoComplete="organization"
          />

          <label htmlFor="workspace-slug">Slug do espaço de trabalho</label>
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
            {loading ? 'Criando espaço de trabalho...' : 'Criar espaço de trabalho'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="workspace-onboarding-title">
        <div className="auth-copy">
          <span className="auth-eyebrow">NexusCRM</span>
          <h1 id="workspace-onboarding-title">Criar seu espaço de trabalho</h1>
          <p>Organize clientes, tarefas, atividades e finanças em um único espaço de trabalho.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="workspace-name">Nome do espaço de trabalho</label>
          <input
            id="workspace-name"
            name="workspace-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Equipe Comercial"
            autoComplete="organization"
          />

          <label htmlFor="workspace-slug">Slug do espaço de trabalho</label>
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
            {loading ? 'Criando espaço de trabalho...' : 'Criar espaço de trabalho'}
          </button>
        </form>
      </section>
    </main>
  )
}
