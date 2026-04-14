import { createHash } from 'node:crypto'
import type { OrcaAgent, OrcaTask } from './client'

export type McAgentRow = {
  id: number
  name: string
  role: string
  session_key: string
  soul_content: string | null
  status: 'offline' | 'idle' | 'busy' | 'error'
  last_seen: number
  last_activity: string | null
  created_at: number
  updated_at: number
  config: string
  workspace_id: number
}

export type McTaskRow = {
  id: number
  title: string
  description: string | null
  status: 'backlog' | 'inbox' | 'assigned' | 'awaiting_owner' | 'in_progress' | 'review' | 'quality_review' | 'done' | 'failed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigned_to: string | null
  created_by: string
  created_at: number
  updated_at: number
  due_date: number | null
  tags: string
  metadata: string
  workspace_id: number
}

const DEFAULT_WORKSPACE_ID = 1

function extractTimestamp(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 10_000_000_000 ? Math.floor(value / 1000) : Math.floor(value)
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsedNumber = Number(value)
    if (Number.isFinite(parsedNumber)) {
      return parsedNumber > 10_000_000_000 ? Math.floor(parsedNumber / 1000) : Math.floor(parsedNumber)
    }
    const parsedDate = Date.parse(value)
    if (!Number.isNaN(parsedDate)) return Math.floor(parsedDate / 1000)
  }
  return fallback
}

function extractString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function makeStableNumericId(kind: 'agent' | 'task', rawId: string): number {
  const hex = createHash('sha1').update(`${kind}:${rawId}`).digest('hex').slice(0, 12)
  const numeric = parseInt(hex, 16)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1
}

function normalizeAgentStatus(status: unknown): McAgentRow['status'] {
  const value = typeof status === 'string' ? status.toLowerCase() : ''
  if (value === 'idle' || value === 'ready') return 'idle'
  if (value === 'busy' || value === 'running' || value === 'in_progress') return 'busy'
  if (value === 'error' || value === 'failed') return 'error'
  return 'offline'
}

function normalizeTaskStatus(status: unknown): McTaskRow['status'] {
  const value = typeof status === 'string' ? status.toLowerCase() : ''
  if (value === 'backlog') return 'backlog'
  if (value === 'assigned') return 'assigned'
  if (value === 'awaiting_owner') return 'awaiting_owner'
  if (value === 'in_progress' || value === 'running') return 'in_progress'
  if (value === 'review') return 'review'
  if (value === 'quality_review') return 'quality_review'
  if (value === 'done' || value === 'completed' || value === 'success') return 'done'
  if (value === 'failed' || value === 'error' || value === 'cancelled') return 'failed'
  return 'inbox'
}

function normalizeTaskPriority(priority: unknown): McTaskRow['priority'] {
  const value = typeof priority === 'string' ? priority.toLowerCase() : ''
  if (value === 'low') return 'low'
  if (value === 'high') return 'high'
  if (value === 'urgent' || value === 'critical') return 'urgent'
  return 'medium'
}

export function orcaAgentToMcAgent(agent: OrcaAgent): McAgentRow {
  const now = Math.floor(Date.now() / 1000)
  const agentId = makeStableNumericId('agent', agent.id)
  const role = extractString(agent.role) || extractString(agent.type) || 'orca-agent'
  const lastSeen = extractTimestamp(agent.last_seen ?? agent.lastSeen ?? agent.updated_at, now)
  const createdAt = extractTimestamp(agent.created_at, now)
  const updatedAt = extractTimestamp(agent.updated_at ?? agent.last_seen, now)
  const lastActivity =
    extractString(agent.last_activity) ||
    extractString(agent.lastActivity) ||
    extractString(agent.summary) ||
    null

  const metadata = {
    framework: 'orca',
    orcaAgentId: agent.id,
    orca: agent.extra,
  }

  return {
    id: agentId,
    name: extractString(agent.name) || `orca:${agent.id}`,
    role,
    session_key: `orca:${agent.id}`,
    soul_content: null,
    status: normalizeAgentStatus(agent.status),
    last_seen: lastSeen,
    last_activity: lastActivity,
    created_at: createdAt,
    updated_at: updatedAt,
    config: JSON.stringify(metadata),
    workspace_id: DEFAULT_WORKSPACE_ID,
  }
}

export function orcaTaskToMcTask(task: OrcaTask): McTaskRow {
  const now = Math.floor(Date.now() / 1000)
  const taskId = makeStableNumericId('task', task.id)
  const createdAt = extractTimestamp(task.created_at, now)
  const updatedAt = extractTimestamp(task.updated_at ?? task.created_at, now)
  const dueDate = extractTimestamp(task.due_date ?? task.dueAt, 0)
  const assignedTo =
    extractString(task.assigned_to) ||
    extractString(task.agent_id) ||
    extractString(task.agentId) ||
    null

  const taskTitle =
    extractString(task.title) ||
    extractString(task.name) ||
    extractString(task.summary) ||
    `Orca task ${task.id.slice(0, 8)}`

  const metadata = {
    framework: 'orca',
    orcaTaskId: task.id,
    orca: task.extra,
  }

  return {
    id: taskId,
    title: taskTitle,
    description: extractString(task.description) || extractString(task.prompt),
    status: normalizeTaskStatus(task.status),
    priority: normalizeTaskPriority(task.priority),
    assigned_to: assignedTo,
    created_by: 'orca-sync',
    created_at: createdAt,
    updated_at: updatedAt,
    due_date: dueDate > 0 ? dueDate : null,
    tags: JSON.stringify(['orca']),
    metadata: JSON.stringify(metadata),
    workspace_id: DEFAULT_WORKSPACE_ID,
  }
}
