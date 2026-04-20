type OrcaRecord = Record<string, unknown>

export type OrcaAgent = OrcaRecord & {
  id: string
  name: string
  status?: string
  extra: OrcaRecord
}

export type OrcaTask = OrcaRecord & {
  id: string
  title?: string
  status?: string
  extra: OrcaRecord
}

export type OrcaTaskStatus = OrcaRecord & {
  id: string
  status?: string
  extra: OrcaRecord
}

const ORCA_API_PREFIX = '/api/v1'
const ORCA_FETCH_TIMEOUT_MS = 10_000

function asRecord(value: unknown): OrcaRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as OrcaRecord)
    : {}
}

function normalizeBaseUrl(input: string): string {
  let base = input.replace(/\/+$/, '')
  // If ORCA_GATEWAY_URL already includes /api/v1, strip it so withApiPrefix() does not
  // produce .../api/v1/api/v1/... (Orca Brain and other routes always add /api/v1).
  if (base.endsWith(ORCA_API_PREFIX)) {
    base = base.slice(0, -ORCA_API_PREFIX.length).replace(/\/+$/, '')
  }
  return base
}

function withApiPrefix(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (normalizedPath.startsWith(ORCA_API_PREFIX)) return normalizedPath
  return `${ORCA_API_PREFIX}${normalizedPath}`
}

function pickListPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  const data = asRecord(payload)
  const candidates = ['items', 'data', 'results', 'agents', 'tasks']
  for (const key of candidates) {
    const value = data[key]
    if (Array.isArray(value)) return value
  }
  return []
}

function normalizeAgent(raw: unknown): OrcaAgent {
  const record = asRecord(raw)
  const idValue = record.id
  const nameValue = record.name
  if (typeof idValue !== 'string' || idValue.length === 0) {
    throw new Error('Orca agent payload does not include string id')
  }

  const normalized: OrcaAgent = {
    ...record,
    id: idValue,
    name: typeof nameValue === 'string' && nameValue.length > 0 ? nameValue : `orca:${idValue}`,
    status: typeof record.status === 'string' ? record.status : undefined,
    extra: { ...record },
  }
  return normalized
}

function normalizeTask(raw: unknown): OrcaTask {
  const record = asRecord(raw)
  const idValue = record.id
  if (typeof idValue !== 'string' || idValue.length === 0) {
    throw new Error('Orca task payload does not include string id')
  }

  const titleValue = record.title
  const normalized: OrcaTask = {
    ...record,
    id: idValue,
    title: typeof titleValue === 'string' ? titleValue : undefined,
    status: typeof record.status === 'string' ? record.status : undefined,
    extra: { ...record },
  }
  return normalized
}

function normalizeTaskStatus(raw: unknown, id: string): OrcaTaskStatus {
  const record = asRecord(raw)
  const statusId = typeof record.id === 'string' ? record.id : id
  return {
    ...record,
    id: statusId,
    status: typeof record.status === 'string' ? record.status : undefined,
    extra: { ...record },
  }
}

export function getOrcaBaseUrl(): string {
  const value = process.env.ORCA_GATEWAY_URL?.trim()
  if (!value) return 'http://localhost:8000'
  return normalizeBaseUrl(value)
}

export function getOrcaToken(): string | null {
  const token = process.env.ORCA_GATEWAY_TOKEN?.trim()
  return token ? token : null
}

export async function orcaFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getOrcaToken()
  if (!token) {
    throw new Error('ORCA_GATEWAY_TOKEN is not set')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ORCA_FETCH_TIMEOUT_MS)

  try {
    const url = `${getOrcaBaseUrl()}${withApiPrefix(path)}`
    const headers = new Headers(init.headers || {})
    headers.set('Authorization', `Bearer ${token}`)
    if (!headers.has('Content-Type') && init.body) {
      headers.set('Content-Type', 'application/json')
    }

    const response = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
      cache: 'no-store',
    })

    const contentType = response.headers.get('content-type') || ''
    const body = contentType.includes('application/json')
      ? await response.json()
      : await response.text()

    if (!response.ok) {
      const details = typeof body === 'string' ? body : JSON.stringify(body)
      throw new Error(`Orca request failed (${response.status}): ${details}`)
    }

    return body as T
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error(`Orca request timeout after ${ORCA_FETCH_TIMEOUT_MS}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function listAgents(): Promise<OrcaAgent[]> {
  const payload = await orcaFetch<unknown>('/agents')
  return pickListPayload(payload).map(normalizeAgent)
}

export async function getAgent(id: string): Promise<OrcaAgent> {
  const payload = await orcaFetch<unknown>(`/agents/${encodeURIComponent(id)}`)
  return normalizeAgent(payload)
}

export async function listTasks(params: { status?: string; limit?: number; agentId?: string } = {}): Promise<OrcaTask[]> {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) query.set('limit', String(params.limit))
  if (params.agentId) query.set('agent_id', params.agentId)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const payload = await orcaFetch<unknown>(`/tasks${suffix}`)
  return pickListPayload(payload).map(normalizeTask)
}

export async function getTask(id: string): Promise<OrcaTask> {
  const payload = await orcaFetch<unknown>(`/tasks/${encodeURIComponent(id)}`)
  return normalizeTask(payload)
}

export async function getTaskStatus(id: string): Promise<OrcaTaskStatus> {
  const payload = await orcaFetch<unknown>(`/tasks/${encodeURIComponent(id)}/status`)
  return normalizeTaskStatus(payload, id)
}

export async function pingOrca(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now()
  try {
    await orcaFetch<unknown>('/health')
    return { ok: true, latencyMs: Date.now() - start }
  } catch (firstError: any) {
    try {
      await orcaFetch<unknown>('/health/ready')
      return { ok: true, latencyMs: Date.now() - start }
    } catch (secondError: any) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: secondError?.message || firstError?.message || 'Orca health check failed',
      }
    }
  }
}

// ── Delegation log ──────────────────────────────
export interface DelegationLogEntry {
  timestamp: string
  agent_id: string
  display_name: string | null
  tool_name: string
  input_tokens: number
  output_tokens: number
  total_cost_usd: number
  model: string
}

export async function listDelegationLog(limit = 50): Promise<DelegationLogEntry[]> {
  const payload = await orcaFetch<unknown>(`/usage/delegation-log?limit=${limit}`)
  return Array.isArray(payload) ? payload : []
}
