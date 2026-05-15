import { useContext } from 'react'
import { RuntimeOrchestrationContext } from '../context/runtimeOrchestrationContext.js'

export function useRuntimeOrchestration() {
  const context = useContext(RuntimeOrchestrationContext)

  if (!context) {
    throw new Error('useRuntimeOrchestration deve ser usado dentro de um RuntimeOrchestrationProvider.')
  }

  return context
}
