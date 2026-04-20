import { getDatabase } from '@/lib/db'
import { listAgents, listDelegationLog, listTasks } from './client'
import { orcaAgentToMcAgent, orcaTaskToMcTask } from './mapping'

type SyncResult = { added: number; updated: number; errors: string[] }

let orcaSyncTimer: NodeJS.Timeout | null = null

export async function syncAgentsFromOrca(): Promise<SyncResult> {
  const result: SyncResult = { added: 0, updated: 0, errors: [] }

  try {
    const agents = await listAgents()
    const db = getDatabase()

    const existsStmt = db.prepare('SELECT id FROM agents WHERE id = ? LIMIT 1')
    const upsertStmt = db.prepare(`
      INSERT INTO agents (
        id, name, role, session_key, soul_content, status, last_seen, last_activity,
        created_at, updated_at, config, workspace_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        role = excluded.role,
        session_key = excluded.session_key,
        soul_content = excluded.soul_content,
        status = excluded.status,
        last_seen = excluded.last_seen,
        last_activity = excluded.last_activity,
        updated_at = excluded.updated_at,
        config = excluded.config,
        workspace_id = excluded.workspace_id
    `)

    const tx = db.transaction(() => {
      for (const orcaAgent of agents) {
        try {
          const mapped = orcaAgentToMcAgent(orcaAgent)
          const existing = existsStmt.get(mapped.id) as { id: number } | undefined
          upsertStmt.run(
            mapped.id,
            mapped.name,
            mapped.role,
            mapped.session_key,
            mapped.soul_content,
            mapped.status,
            mapped.last_seen,
            mapped.last_activity,
            mapped.created_at,
            mapped.updated_at,
            mapped.config,
            mapped.workspace_id
          )
          if (existing) result.updated += 1
          else result.added += 1
        } catch (error: any) {
          result.errors.push(`agent:${String((orcaAgent as any)?.id || 'unknown')}: ${error?.message || 'unknown error'}`)
        }
      }
    })

    tx()
    console.info(`[orca-sync] agents synced: added=${result.added}, updated=${result.updated}, errors=${result.errors.length}`)
  } catch (error: any) {
    const message = error?.message || 'failed to sync agents'
    result.errors.push(message)
    console.error(`[orca-sync] agents sync failed: ${message}`)
  }

  return result
}

export async function syncTasksFromOrca(): Promise<SyncResult> {
  const result: SyncResult = { added: 0, updated: 0, errors: [] }

  try {
    const tasks = await listTasks()
    const db = getDatabase()

    const existsStmt = db.prepare('SELECT id FROM tasks WHERE id = ? LIMIT 1')
    const upsertStmt = db.prepare(`
      INSERT INTO tasks (
        id, title, description, status, priority, assigned_to, created_by, created_at,
        updated_at, due_date, tags, metadata, workspace_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        status = excluded.status,
        priority = excluded.priority,
        assigned_to = excluded.assigned_to,
        updated_at = excluded.updated_at,
        due_date = excluded.due_date,
        tags = excluded.tags,
        metadata = excluded.metadata,
        workspace_id = excluded.workspace_id
    `)

    const tx = db.transaction(() => {
      for (const orcaTask of tasks) {
        try {
          const mapped = orcaTaskToMcTask(orcaTask)
          const existing = existsStmt.get(mapped.id) as { id: number } | undefined
          upsertStmt.run(
            mapped.id,
            mapped.title,
            mapped.description,
            mapped.status,
            mapped.priority,
            mapped.assigned_to,
            mapped.created_by,
            mapped.created_at,
            mapped.updated_at,
            mapped.due_date,
            mapped.tags,
            mapped.metadata,
            mapped.workspace_id
          )
          if (existing) result.updated += 1
          else result.added += 1
        } catch (error: any) {
          result.errors.push(`task:${String((orcaTask as any)?.id || 'unknown')}: ${error?.message || 'unknown error'}`)
        }
      }
    })

    tx()
    console.info(`[orca-sync] tasks synced: added=${result.added}, updated=${result.updated}, errors=${result.errors.length}`)
  } catch (error: any) {
    const message = error?.message || 'failed to sync tasks'
    result.errors.push(message)
    console.error(`[orca-sync] tasks sync failed: ${message}`)
  }

  return result
}

export async function syncDelegationActivitiesFromOrca(): Promise<SyncResult> {
  const result: SyncResult = { added: 0, updated: 0, errors: [] }

  try {
    const entries = await listDelegationLog(50)
    if (!entries.length) return result

    const db = getDatabase()

    const checkStmt = db.prepare(
      `SELECT id FROM activities WHERE type = 'delegation_completed' AND actor = ? AND created_at = ? AND workspace_id = 1 LIMIT 1`,
    )

    const insertStmt = db.prepare(`
      INSERT INTO activities (type, entity_type, entity_id, actor, description, data, created_at, workspace_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const tx = db.transaction(() => {
      for (const entry of entries) {
        try {
          const ts = Math.floor(new Date(entry.timestamp).getTime() / 1000)
          const actor = entry.display_name || entry.agent_id

          const existing = checkStmt.get(actor, ts) as { id: number } | undefined
          if (existing) continue

          const description = `Делегирование: ${entry.tool_name} → ${entry.display_name || entry.agent_id} (${entry.input_tokens + entry.output_tokens} tok, $${entry.total_cost_usd.toFixed(4)})`

          insertStmt.run(
            'delegation_completed',
            'task',
            0,
            actor,
            description,
            JSON.stringify({
              agent_id: entry.agent_id,
              display_name: entry.display_name,
              tool_name: entry.tool_name,
              input_tokens: entry.input_tokens,
              output_tokens: entry.output_tokens,
              total_cost_usd: entry.total_cost_usd,
              model: entry.model,
              source_timestamp: entry.timestamp,
            }),
            ts,
            1,
          )

          result.added += 1
        } catch (err: any) {
          result.errors.push(`delegation:${entry.agent_id}: ${err?.message || 'unknown error'}`)
        }
      }
    })

    tx()
    console.info(`[orca-sync] delegation activities synced: added=${result.added}, errors=${result.errors.length}`)
  } catch (err: any) {
    const message = err?.message || 'failed to sync delegation activities'
    result.errors.push(message)
    console.error(`[orca-sync] delegation activities sync failed: ${message}`)
  }

  return result
}

export async function syncAll(): Promise<{
  agents: SyncResult
  tasks: SyncResult
  delegationActivities: SyncResult
  startedAt: string
  finishedAt: string
}> {
  const startedAt = new Date().toISOString()
  console.info(`[orca-sync] sync started at ${startedAt}`)

  const agents = await syncAgentsFromOrca()
  const tasks = await syncTasksFromOrca()
  const delegationActivities = await syncDelegationActivitiesFromOrca()

  const finishedAt = new Date().toISOString()
  console.info(`[orca-sync] sync finished at ${finishedAt}`)

  return {
    agents,
    tasks,
    delegationActivities,
    startedAt,
    finishedAt,
  }
}

export function startOrcaSyncLoop(intervalMs?: number): () => void {
  const configured = Number(process.env.ORCA_SYNC_INTERVAL_MS || '30000')
  const effectiveInterval =
    typeof intervalMs === 'number' && Number.isFinite(intervalMs) && intervalMs > 0
      ? intervalMs
      : (Number.isFinite(configured) && configured > 0 ? configured : 30_000)

  if (orcaSyncTimer) {
    clearInterval(orcaSyncTimer)
  }

  orcaSyncTimer = setInterval(() => {
    syncAll().catch((error: any) => {
      console.error(`[orca-sync] loop iteration failed: ${error?.message || 'unknown error'}`)
    })
  }, effectiveInterval)

  console.info(`[orca-sync] loop started (${effectiveInterval}ms)`)

  return () => {
    if (orcaSyncTimer) {
      clearInterval(orcaSyncTimer)
      orcaSyncTimer = null
      console.info('[orca-sync] loop stopped')
    }
  }
}
