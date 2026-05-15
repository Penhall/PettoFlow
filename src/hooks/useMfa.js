import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient.js'

export function useMfa() {
  const [factors, setFactors] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isMfaEnrolled = factors.some((factor) => factor.status === 'verified' && factor.factor_type === 'totp')

  const listFactors = useCallback(async () => {
    if (!supabase) return []
    setLoading(true)
    setError('')
    try {
      const { data, error: fetchError } = await supabase.auth.mfa.listFactors()
      if (fetchError) throw fetchError
      const allFactors = data?.all ?? []
      setFactors(allFactors)
      return allFactors
    } catch (err) {
      setError(err.message || 'Erro ao listar fatores')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    listFactors()
  }, [listFactors])

  const enroll = useCallback(async () => {
    if (!supabase) throw new Error('Supabase não configurado')
    setLoading(true)
    setError('')
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'NexusCRM',
      })
      if (enrollError) throw enrollError
      return {
        id: data.id,
        type: data.type,
        totpUri: data.totp?.uri ?? null,
        qrCode: data.totp?.qr_code ?? null,
        secret: data.totp?.secret ?? null,
      }
    } catch (err) {
      setError(err.message || 'Erro ao iniciar configuração MFA')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const challenge = useCallback(async (factorId) => {
    if (!supabase) throw new Error('Supabase não configurado')
    const { data, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    })
    if (challengeError) throw challengeError
    return data.id
  }, [])

  const verify = useCallback(async (factorId, challengeId, code) => {
    if (!supabase) throw new Error('Supabase não configurado')
    const { data, error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code,
    })
    if (verifyError) throw verifyError
    return data
  }, [])

  const challengeAndVerify = useCallback(async (factorId, code) => {
    const challengeId = await challenge(factorId)
    return verify(factorId, challengeId, code)
  }, [challenge, verify])

  const unenroll = useCallback(async (factorId) => {
    if (!supabase) throw new Error('Supabase não configurado')
    setLoading(true)
    setError('')
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId,
      })
      if (unenrollError) throw unenrollError
      await listFactors()
    } catch (err) {
      setError(err.message || 'Erro ao desativar 2FA')
    } finally {
      setLoading(false)
    }
  }, [listFactors])

  return {
    factors,
    loading,
    error,
    isMfaEnrolled,
    listFactors,
    enroll,
    challenge,
    verify,
    challengeAndVerify,
    unenroll,
  }
}
