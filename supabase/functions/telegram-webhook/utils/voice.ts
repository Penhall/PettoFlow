// supabase/functions/telegram-webhook/utils/voice.ts

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const CHUNK = 32768
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)))
  }
  return btoa(binary)
}

export async function transcribeVoice(
  botToken: string,
  fileId: string,
  geminiApiKey: string
): Promise<string | null> {
  try {
    // 1. Obtém o caminho do arquivo no Telegram
    const fileRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    )
    if (!fileRes.ok) return null
    const fileData = await fileRes.json()
    const filePath = fileData.result?.file_path
    if (!filePath) return null

    // 2. Baixa o arquivo de áudio
    const audioRes = await fetch(
      `https://api.telegram.org/file/bot${botToken}/${filePath}`
    )
    if (!audioRes.ok) return null
    const audioBuffer = await audioRes.arrayBuffer()

    // 3. Converte para base64
    const base64Audio = arrayBufferToBase64(audioBuffer)

    console.log(`[voice] audio downloaded, size=${audioBuffer.byteLength} bytes`)

    // 4. Envia para Gemini para transcrição
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              {
                inline_data: {
                  mime_type: 'audio/ogg',
                  data: base64Audio,
                },
              },
              {
                text: 'Transcreva este áudio em português. Responda APENAS com a transcrição, sem explicações adicionais.',
              },
            ],
          }],
          generationConfig: { maxOutputTokens: 500, temperature: 0 },
        }),
      }
    )

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text()
      console.error(`[voice] Gemini error ${geminiRes.status}: ${errBody}`)
      throw new Error(`GEMINI_${geminiRes.status}: ${errBody.slice(0, 200)}`)
    }
    const geminiData = await geminiRes.json()
    const transcript = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    console.log(`[voice] transcript="${transcript}"`)
    return transcript || null
  } catch (err) {
    console.error('[voice] exception:', err)
    throw err
  }
}
