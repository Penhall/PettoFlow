import { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, FileText, FileImage, File, Download, Trash2 } from 'lucide-react'
import { uploadFile, deleteFile, listAttachments, getFileUrl } from '../../lib/storage.js'
import { normalizeError } from '../../lib/mutationResult.js'

const FILE_ICONS = {
  'application/pdf': FileText,
  'image/png': FileImage,
  'image/jpeg': FileImage,
  'image/webp': FileImage,
}

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

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
    const items = await listAttachments(entityType, entityId, tenantId)
    const withUrls = await Promise.all(
      items.map(async (item) => ({
        ...item,
        url: await getFileUrl(item.storage_path),
      }))
    )
    setAttachments(withUrls)
  }, [entityType, entityId, tenantId])

  useEffect(() => { load() }, [load])

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
          errors.push(`"${file.name}" tipo não permitido. Use PNG, JPG, WebP ou PDF.`)
          continue
        }
        await uploadFile(file, entityType, entityId, tenantId)
      }
      if (errors.length > 0) setError(errors.join('. '))
      await load()
    } catch (err) {
      setError(normalizeError(err, { operation: 'files.upload' }).message)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(attachment) {
    if (!window.confirm(`Remover "${attachment.file_name}"?`)) return
    try {
      await deleteFile(attachment)
      setAttachments((prev) => prev.filter((item) => item.id !== attachment.id))
    } catch (err) {
      setError(normalizeError(err, { operation: 'files.delete' }).message)
    }
  }

  return (
    <div className="file-uploader">
      {error && (
        <div className="file-uploader__error">{error}</div>
      )}

      <div
        className={`file-uploader__dropzone ${dragOver ? 'file-uploader__dropzone--active' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          handleFiles(event.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
      >
        <Upload size={24} />
        <span>Arraste arquivos aqui ou clique para selecionar</span>
        <span className="file-uploader__hint">PNG, JPG, WebP, PDF - até 10MB</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="file-uploader__input"
          onChange={(event) => {
            handleFiles(event.target.files)
            event.target.value = ''
          }}
        />
      </div>

      {uploading && <div className="file-uploader__progress">Enviando...</div>}

      {attachments.length > 0 && (
        <div className="file-uploader__list">
          {attachments.map((attachment) => {
            const Icon = getFileIcon(attachment.mime_type)
            const isImage = attachment.mime_type?.startsWith('image/')

            return (
              <div key={attachment.id} className="file-uploader__item">
                {isImage && attachment.url ? (
                  <img src={attachment.url} alt={attachment.file_name} className="file-uploader__thumb" />
                ) : (
                  <Icon size={20} className="file-uploader__icon" />
                )}
                <div className="file-uploader__meta">
                  <strong>{attachment.file_name}</strong>
                  <span>{formatFileSize(attachment.file_size)}</span>
                </div>
                <div className="file-uploader__actions">
                  {attachment.url && (
                    <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="file-uploader__action" title="Download">
                      <Download size={16} />
                    </a>
                  )}
                  <button type="button" className="file-uploader__action file-uploader__action--delete" onClick={() => handleDelete(attachment)} title="Remover">
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
