import { supabase } from './supabaseClient.js'

const BUCKET_NAME = 'nexuscrm-files'

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

  const { data: userData } = await supabase.auth.getUser()
  const { data: attachment, error: dbError } = await supabase
    .from('file_attachments')
    .insert({
      tenant_id: tenantId,
      user_id: userData?.user?.id,
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
    throw new Error(`Erro ao remover arquivo do storage: ${storageError.message}`)
  }

  const { error: dbError } = await supabase
    .from('file_attachments')
    .delete()
    .eq('id', attachment.id)

  if (dbError) throw dbError
}

export async function getFileUrl(storagePath) {
  if (!supabase) return null
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, 3600)

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

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

  if (error) {
    console.error('Erro ao listar attachments:', error)
    return []
  }
  return data ?? []
}
