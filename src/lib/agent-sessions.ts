import { getOrcaToken, pingOrca } from '@/lib/orca/client'

// Neutral no-op shims replacing removed hermes-* modules.
export type ExternalAgentSessionRow = {
  sessionId: string
  title?: string
  isActive: boolean
  lastMessageAt?: string | null
  firstMessageAt?: string | null
  inputTokens: number
  outputTokens: number
  model?: string
  source?: string
  messageCount: number
  toolCallCount: number
}

export const isExternalAgentInstalled = (): boolean => false
export const scanExternalAgentSessions = async (_limit?: number): Promise<ExternalAgentSessionRow[]> => []
export const clearAgentDetectionCache = (): void => {}

/** True when Orca gateway env is set and the remote /health check succeeds (same signal as /api/orca/status). */
export async function isExternalGatewayRunning(): Promise<boolean> {
  if (!process.env.ORCA_GATEWAY_URL?.trim()) return false
  if (!getOrcaToken()) return false
  const ping = await pingOrca()
  return ping.ok
}
