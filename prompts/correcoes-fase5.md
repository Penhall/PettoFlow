# Correções Fase 5 — Storage/Upload

Diretório: /root/PettoFlow

Aplique as correções abaixo baseadas na revisão do Claude Code.

## 1. src/lib/storage.js

### #1 — deleteFile: não deletar registro do DB se storage falhar
Mudar o fluxo para lançar erro se storage falhar, em vez de continuar e deletar o registro:
```javascript
export async function deleteFile(attachment) {
  if (!supabase) throw new Error('Supabase nao configurado')

  const { error: storageError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([attachment.storage_path])

  if (storageError) {
    throw new Error(`Erro ao remover arquivo do storage: ${storageError.message}`)
  }

  const { error: dbError } = await supabase
    .from('file_attachments')
    .delete()
    .eq('id', attachment.id)

  if (dbError) throw dbError
}
```

### #2 — getFileUrl: remover fallback para getPublicUrl
O bucket é privado. Se createSignedUrl falhar, deve retornar null, não cair em public URL:
```javascript
export async function getFileUrl(storagePath) {
  if (!supabase) return null
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, 3600)

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}
```

### #4 — listAttachments: adicionar filtro tenant_id
```javascript
export async function listAttachments(entityType, entityId, tenantId) {
  if (!supabase) return []
  let query = supabase
    .from('file_attachments')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', String(entityId))
  if (tenantId) {
    query = query.eq('tenant_id', tenantId)
  }
  const { data, error } = await query.order('created_at', { ascending: false })
  // ...
}
```

### #6 — ensureBucketExists: remover função
Remover a função `ensureBucketExists` inteira. O bucket deve ser criado via Supabase Dashboard. A função dava falsa confiança pois usava anon key.

## 2. src/components/shared/FileUploader.jsx

### #5 — Validar MIME type no drag-and-drop
Adicionar validação de tipo MIME no handleFiles, antes do upload:
```javascript
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

async function handleFiles(files) {
    if (!files?.length || !tenantId || !entityId) return
    setError('')
    setUploading(true)
    const errors = []
    try {
      for (const file of files) {
        if (file.size > 10485760) {
          errors.push(`"${file.name}" excede 10MB`)
          continue
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
          errors.push(`"${file.name}" tipo nao permitido. Use PNG, JPG, WebP ou PDF.`)
          continue
        }
        await uploadFile(file, entityType, entityId, tenantId)
      }
      if (errors.length > 0) setError(errors.join('. '))
      await load()
    } catch (err) {
      setError(err.message || 'Erro ao fazer upload')
    } finally {
      setUploading(false)
    }
  }
```

### #7 — Confirmar antes de deletar
Adicionar window.confirm no handleDelete:
```javascript
async function handleDelete(attachment) {
    if (!window.confirm(`Remover "${attachment.file_name}"?`)) return
    try {
      await deleteFile(attachment)
      setAttachments((prev) => prev.filter((item) => item.id !== attachment.id))
    } catch (err) {
      setError(err.message || 'Erro ao remover arquivo')
    }
  }
```

### #4 — Passar tenantId para listAttachments
No hook load, passar tenantId para listAttachments:
```javascript
const load = useCallback(async () => {
    if (!entityId) return
    const items = await listAttachments(entityType, entityId, tenantId)
    // ...
  }, [entityType, entityId, tenantId]) // adicionar tenantId nas deps
```

## 3. supabase/migrations/20260513100000_storage_uploads.sql

### #3 — ON DELETE CASCADE: mudar para SET NULL ou manter mas adicionar trigger
Trocar a constraint de user_id para não fazer cascade. Se o usuário for deletado, o attachment fica sem user_id mas o arquivo sobrevive:
```sql
user_id uuid references auth.users(id) on delete set null,
```
(user_id precisa ser nullable)

Alterar no CREATE TABLE:
```sql
user_id uuid references auth.users(id) on delete set null,
```

## Regras
- 2 espaços de indentação
- Não adicionar dependências npm novas
- Manter estilo consistente com o código existente
