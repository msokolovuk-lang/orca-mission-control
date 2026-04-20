import { orcaFetch } from './client'

// ── Типы ────────────────────────────────────────
export interface DelegationLogEntry {
  timestamp: string // ISO 8601
  agent_id: string // ключ агента (например "copywriter")
  display_name: string | null
  tool_name: string // delegate_to_agent | delegate_parallel | run_council
  input_tokens: number
  output_tokens: number
  total_cost_usd: number
  model: string
}

export interface UsageSummary {
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
  total_records: number
  period_start: string
  period_end: string
}

export interface UsageByAgentEntry {
  agent_id: string // UUID
  day: string // YYYY-MM-DD
  input_tokens: number
  output_tokens: number
  cost_usd: number
  tasks_count: number
}

export interface UsageByModelEntry {
  model: string
  day: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

export interface UsageDailyEntry {
  day: string
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
  tasks_count: number
}

// ── Функции ─────────────────────────────────────
export async function fetchDelegationLog(limit = 100): Promise<DelegationLogEntry[]> {
  try {
    return await orcaFetch<DelegationLogEntry[]>(`/usage/delegation-log?limit=${limit}`)
  } catch (err) {
    console.error('[orca-usage] fetchDelegationLog failed:', err)
    return []
  }
}

export async function fetchUsageSummary(): Promise<UsageSummary | null> {
  try {
    return await orcaFetch<UsageSummary>('/usage/summary')
  } catch (err) {
    console.error('[orca-usage] fetchUsageSummary failed:', err)
    return null
  }
}

export async function fetchUsageByAgent(): Promise<UsageByAgentEntry[]> {
  try {
    return await orcaFetch<UsageByAgentEntry[]>('/usage/by-agent')
  } catch (err) {
    console.error('[orca-usage] fetchUsageByAgent failed:', err)
    return []
  }
}

export async function fetchUsageByModel(): Promise<UsageByModelEntry[]> {
  try {
    return await orcaFetch<UsageByModelEntry[]>('/usage/by-model')
  } catch (err) {
    console.error('[orca-usage] fetchUsageByModel failed:', err)
    return []
  }
}

export async function fetchUsageDaily(): Promise<UsageDailyEntry[]> {
  try {
    return await orcaFetch<UsageDailyEntry[]>('/usage/daily')
  } catch (err) {
    console.error('[orca-usage] fetchUsageDaily failed:', err)
    return []
  }
}
