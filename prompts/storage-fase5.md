# Fase 5: Storage/Upload — Implementação

Adicione upload de arquivos ao NexusCRM usando Supabase Storage.

Diretório: /root/PettoFlow

## Contexto do Projeto
- React 18 + Vite (JavaScript, não TypeScript)
- Edge Functions em Deno (TypeScript)
- CSS puro, classes BEM-like, variáveis CSS
- PT-BR em toda interface
- Supabase client já configurado em src/lib/supabaseClient.js (exporta `supabase`)
- `supabase.storage` está disponível (Storage habilitado no projeto Supabase)
- Nomes de arquivo: PascalCase.jsx para componentes, camelCase.js para libs/hooks

## Arquivos para criar

### 1. supabase/migrations/20260513100000_storage_uploads.sql

Migration SQL:
```sql
-- Bucket será criado via Supabase Dashboard ou Storage API
-- Mas precisamos da tabela de rastreamento

create table if not exists public.file_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_size integer not null,
  mime_type text,
  storage_path text not null,
  entity_type text not null,
  entity_id text not null,
  created_at timestamptz not null default now(),
  constraint file_attachments_entity_type_check check (
    entity_type in ('client', 'task', 'transaction')
  )
);

alter table public.file_attachments enable row level security;

-- Policies
drop policy if exists "service role full access" on public.file_attachments;
create policy "service role full access"
  on public.file_attachments for all to service_role using (true) with check (true);

drop policy if exists "authenticated select own tenant attachments" on public.file_attachments;
create policy "authenticated select own tenant attachments"
  on public.file_attachments for select to authenticated
  using (tenant_id in (
    select tenant_id from public.memberships where user_id = auth.uid() and status = 'active'
  ));

drop policy if exists "authenticated insert own tenant attachments" on public.file_attachments;
create policy "authenticated insert own tenant attachments"
  on public.file_attachments for insert to authenticated
  with check (tenant_id in (
    select tenant_id from public.memberships where user_id = auth.uid() and status = 'active'
  ));

drop policy if exists "authenticated delete own tenant attachments" on public.file_attachments;
create policy "authenticated delete own tenant attachments"
  on public.file_attachments for delete to authenticated
  using (tenant_id in (
    select tenant_id from public.memberships where user_id = auth.uid() and status = 'active'
  ));

grant select, insert, delete on public.file_attachments to authenticated;

create index if not exists file_attachments_entity_idx on public.file_attachments (entity_type, entity_id);
create index if not exists file_attachments_tenant_idx on public.file_attachments (tenant_id);
```

### 2. src/lib/storage.js

Utilitário de storage:

```javascript
import { supabase } from './supabaseClient.js'

const BUCKET_NAME = 'nexuscrm-files'

// Gera caminho no bucket: {tenantId}/{entityType}/{entityId}/{uuid}-{filename}
function buildStoragePath(tenantId, entityType, entityId, fileName) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const prefix = crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)
  return `${tenantId}/${entityType}/${entityId}/${prefix}-${safe}`
}

export async function uploadFile(file, entityType, entityId, tenantId) {
  if (!supabase) throw new Error('Supabase nao configurado')
  if (!tenantId) throw new Error('tenant_id obrigatorio')

  const storagePath = buildStoragePath(tenantId, entityType, entityId, file.name)

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) throw uploadError

  // Registrar no banco
  const { data: attachment, error: dbError } = await supabase
    .from('file_attachments')
    .insert({
      tenant_id: tenantId,
      user_id: (await supabase.auth.getUser()).data?.user?.id,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      storage_path: storagePath,
      entity_type: entityType,
      entity_id: String(entityId),
    })
    .select()
    .single()

  if (dbError) {
    // Rollback do upload
    await supabase.storage.from(BUCKET_NAME).remove([storagePath])
    throw dbError
  }

  return attachment
}

export async function deleteFile(attachment) {
  if (!supabase) throw new Error('Supabase nao configurado')

  const { error: storageError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([attachment.storage_path])

  if (storageError) {
    console.error('Erro ao remover arquivo do storage:', storageError)
  }

  const { error: dbError } = await supabase
    .from('file_attachments')
    .delete()
    .eq('id', attachment.id)

  if (dbError) throw dbError
}

export async function getFileUrl(storagePath) {
  if (!supabase) return null
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath)
  return data?.publicUrl ?? null
}

export async function listAttachments(entityType, entityId) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('file_attachments')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', String(entityId))
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao listar attachments:', error)
    return []
  }
  return data ?? []
}

export async function ensureBucketExists() {
  if (!supabase) return false
  // Tenta criar o bucket se não existir (pode falhar se o usuário não for admin)
  try {
    const { data: buckets } = await supabase.storage.listBuckets()
    if (buckets?.some(b => b.name === BUCKET_NAME)) return true
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
      fileSizeLimit: 10485760, // 10MB
    })
    if (error) {
      console.warn('Nao foi possivel criar bucket automaticamente:', error.message)
      return false
    }
    return true
  } catch {
    return false
  }
}
```

### 3. src/components/shared/FileUploader.jsx

Componente React de upload de arquivos:

```jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, X, FileText, FileImage, File, Download, Trash2 } from 'lucide-react'
import { uploadFile, deleteFile, listAttachments, getFileUrl } from '../../lib/storage.js'

const FILE_ICONS = {
  'application/pdf': FileText,
  'image/png': FileImage,
  'image/jpeg': FileImage,
  'image/webp': FileImage,
}

function getFileIcon(mimeType) {
  return FILE_ICONS[mimeType] || File
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export default function FileUploader({ entityType, entityId, tenantId }) {
  const [attachments, setAttachments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const load = useCallback(async () => {
    if (!entityId) return
    const items = await listAttachments(entityType, entityId)
    const withUrls = await Promise.all(
      items.map(async (item) => ({
        ...item,
        url: await getFileUrl(item.storage_path),
      }))
    )
    setAttachments(withUrls)
  }, [entityType, entityId])

  useEffect(() => { load() }, [load])

  async function handleFiles(files) {
    if (!files?.length || !tenantId || !entityId) return
    setError('')
    setUploading(true)
    try {
      for (const file of files) {
        if (file.size > 10485760) {
          setError(`"${file.name}" excede 10MB`)
          continue
        }
        await uploadFile(file, entityType, entityId, tenantId)
      }
      await load()
    } catch (err) {
      setError(err.message || 'Erro ao fazer upload')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(attachment) {
    try {
      await deleteFile(attachment)
      setAttachments(prev => prev.filter(a => a.id !== attachment.id))
    } catch (err) {
      setError(err.message || 'Erro ao remover arquivo')
    }
  }

  return (
    <div className="file-uploader">
      {error && (
        <div className="file-uploader__error">{error}</div>
      )}

      {/* Dropzone */}
      <div
        className={`file-uploader__dropzone ${dragOver ? 'file-uploader__dropzone--active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={24} />
        <span>Arraste arquivos aqui ou clique para selecionar</span>
        <span className="file-uploader__hint">PNG, JPG, WebP, PDF — até 10MB</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      {uploading && <div className="file-uploader__progress">Enviando...</div>}

      {/* Lista de arquivos */}
      {attachments.length > 0 && (
        <div className="file-uploader__list">
          {attachments.map((att) => {
            const Icon = getFileIcon(att.mime_type)
            const isImage = att.mime_type?.startsWith('image/')
            return (
              <div key={att.id} className="file-uploader__item">
                {isImage && att.url ? (
                  <img src={att.url} alt={att.file_name} className="file-uploader__thumb" />
                ) : (
                  <Icon size={20} className="file-uploader__icon" />
                )}
                <div className="file-uploader__meta">
                  <strong>{att.file_name}</strong>
                  <span>{formatFileSize(att.file_size)}</span>
                </div>
                <div className="file-uploader__actions">
                  {att.url && (
                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="file-uploader__action" title="Download">
                      <Download size={16} />
                    </a>
                  )}
                  <button type="button" className="file-uploader__action file-uploader__action--delete" onClick={() => handleDelete(att)} title="Remover">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

## Arquivos para modificar

### 4. src/components/Clients/ClientProfileModal.jsx

Adicionar uma seção "Documentos" no modal. Encontre a estrutura do modal (tem seções como "Histórico de interações", "Transações vinculadas"). Adicione FileUploader como uma nova seção no final, antes do fechamento do container principal.

Importar:
```jsx
import FileUploader from '../shared/FileUploader.jsx'
```

Usar:
```jsx
<section className="client-profile-section">
  <div className="client-profile-section__header">
    <div>
      <span className="client-profile-section__eyebrow">Arquivos</span>
      <h3>Documentos</h3>
    </div>
  </div>
  <FileUploader
    entityType="client"
    entityId={client.id}
    tenantId={activeTenantId}
  />
</section>
```

O `activeTenantId` pode vir do hook useTenant. O modal já tem vários hooks, verifique se já importa `useTenant`.

### 5. src/components/Tasks/TaskModal.jsx

Adicionar FileUploader para anexos de tarefa. Encontre o form do modal e adicione uma seção de anexos após os campos existentes, antes do botão de submit.

Importar:
```jsx
import FileUploader from '../shared/FileUploader.jsx'
```

Usar (quando task.id existe, ou seja, edição):
```jsx
{task && task.id && (
  <div className="task-attachments-section" style={{ marginTop: 16 }}>
    <label style={{ fontSize: '0.85em', fontWeight: 600, display: 'block', marginBottom: 8 }}>Anexos</label>
    <FileUploader entityType="task" entityId={task.id} tenantId={activeTenantId} />
  </div>
)}
```

Recupere `activeTenantId` de onde estiver disponível no escopo (pode ser via props ou hook).

### 6. src/components/Finance/TransactionForm.jsx

Adicionar FileUploader para comprovantes. Em transações, o upload de comprovante (foto do recibo, PDF da nota fiscal) faz sentido quando a transação já foi salva (tem id). Adicione uma seção condicional:

```jsx
import FileUploader from '../shared/FileUploader.jsx'
```

Usar (quando `transaction?.id` existe):
```jsx
{transaction?.id && (
  <div style={{ marginTop: 16 }}>
    <label style={{ fontSize: '0.85em', fontWeight: 600, display: 'block', marginBottom: 8 }}>Comprovante</label>
    <FileUploader entityType="transaction" entityId={transaction.id} tenantId={tenantId} />
  </div>
)}
```

Se `tenantId` não estiver disponível diretamente, use um hook ou prop.

### 7. src/index.css

Adicionar estilos para FileUploader no final do arquivo:

```css
.file-uploader {
  display: grid;
  gap: 12px;
}
.file-uploader__error {
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(220, 38, 38, 0.12);
  color: #fecaca;
  font-size: 13px;
}
.file-uploader__dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 16px;
  border: 2px dashed var(--border-color);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  color: var(--text-secondary);
  text-align: center;
}
.file-uploader__dropzone:hover,
.file-uploader__dropzone--active {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 8%, transparent);
}
.file-uploader__hint {
  font-size: 12px;
  color: var(--text-secondary);
}
.file-uploader__progress {
  font-size: 14px;
  color: var(--text-secondary);
  text-align: center;
}
.file-uploader__list {
  display: grid;
  gap: 8px;
}
.file-uploader__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--card-bg);
}
.file-uploader__thumb {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
}
.file-uploader__icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}
.file-uploader__meta {
  flex: 1;
  min-width: 0;
}
.file-uploader__meta strong {
  display: block;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-uploader__meta span {
  font-size: 12px;
  color: var(--text-secondary);
}
.file-uploader__actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.file-uploader__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.file-uploader__action:hover {
  background: var(--bg-secondary);
}
.file-uploader__action--delete:hover {
  color: #ef4444;
  background: rgba(220, 38, 38, 0.12);
}
```

## Regras
- 2 espaços de indentação
- PT-BR em labels (nomes de variáveis em inglês)
- Não adicionar dependências npm novas
- Botão de trigger deve ser type="button" para não submeter formulários
- Não quebrar funcionalidades existentes nos modais
