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
export const isExternalGatewayRunning = (): boolean => false
