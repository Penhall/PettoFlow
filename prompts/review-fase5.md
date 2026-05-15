Revisão da Fase 5 — Storage/Upload (NexusCRM).

Valide as implementações abaixo no diff (git diff HEAD):

1. supabase/migrations/20260513100000_storage_uploads.sql — tabela file_attachments, RLS, policies storage.objects
2. src/lib/storage.js — uploadFile, deleteFile, getFileUrl (signed URL), listAttachments, ensureBucketExists
3. src/components/shared/FileUploader.jsx — drag & drop, upload, preview, delete
4. src/components/Clients/ClientProfileModal.jsx — seção "Documentos"
5. src/components/Tasks/TaskModal.jsx — seção "Anexos"
6. src/components/Finance/TransactionForm.jsx — seção "Comprovante"
7. src/index.css — estilos file-uploader

Aponte problemas de segurança, bugs, inconsistências com o padrão do projeto, e sugestões de melhoria. Seja direto.
