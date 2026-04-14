import { NextRequest, NextResponse } from 'next/server'
import { existsSync, readdirSync, statSync } from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { config } from '@/lib/config'
import { requireRole } from '@/lib/auth'
import { readLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { getGraph, listVaults } from '@/lib/orca/brain'
import { brainGraphToMcGraph } from '@/lib/orca/memory-mapping'

interface AgentFileInfo {
  path: string
  chunks: number
  textSize: number
}

interface AgentGraphData {
  name: string
  dbSize: number
  totalChunks: number
  totalFiles: number
  files: AgentFileInfo[]
}

const memoryDbDir = config.openclawStateDir
  ? path.join(config.openclawStateDir, 'memory')
  : ''

function isOrcaBrainConfigured(): boolean {
  return Boolean(process.env.ORCA_GATEWAY_URL?.trim() && process.env.ORCA_GATEWAY_TOKEN?.trim())
}

function getErrorDetail(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Unknown Orca Brain error'
}

function getAgentData(dbPath: string, agentName: string): AgentGraphData | null {
  try {
    const dbStat = statSync(dbPath)
    const db = new Database(dbPath, { readonly: true, fileMustExist: true })

    let files: AgentFileInfo[] = []
    let totalChunks = 0
    let totalFiles = 0

    try {
      // Check if chunks table exists
      const tableCheck = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chunks'")
        .get() as { name: string } | undefined

      if (tableCheck) {
        // Use COUNT only — skip SUM(LENGTH(text)) which forces a full data scan
        const rows = db
          .prepare(
            'SELECT path, COUNT(*) as chunks FROM chunks GROUP BY path ORDER BY chunks DESC'
          )
          .all() as Array<{ path: string; chunks: number }>

        files = rows.map((r) => ({
          path: r.path || '(unknown)',
          chunks: r.chunks,
          textSize: 0,
        }))

        totalChunks = files.reduce((sum, f) => sum + f.chunks, 0)
        totalFiles = files.length
      }
    } finally {
      db.close()
    }

    return {
      name: agentName,
      dbSize: dbStat.size,
      totalChunks,
      totalFiles,
      files,
    }
  } catch (err) {
    logger.warn(`Failed to read memory DB for agent "${agentName}": ${err}`)
    return null
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const limited = readLimiter(request)
  if (limited) return limited

  const agentFilter = request.nextUrl.searchParams.get('agent') || 'all'

  if (isOrcaBrainConfigured()) {
    try {
      const targetVaults =
        agentFilter === 'all' ? (await listVaults()).vaults : [agentFilter]
      const agents: Array<{
        id: string
        name: string
        nodes: Array<{ id: string; label: string }>
        edges: Array<{ source: string; target: string }>
        dbSize: number
        totalChunks: number
        totalFiles: number
        files: Array<{ path: string; chunks: number; textSize: number }>
      }> = []

      for (const vault of targetVaults) {
        const graph = await getGraph(vault)
        const mapped = brainGraphToMcGraph(graph, vault)
        agents.push(...mapped.agents)
      }

      return NextResponse.json({ agents })
    } catch (error) {
      logger.warn({ err: error }, 'Orca Brain graph request failed')
      return NextResponse.json(
        { error: 'orca-brain-unavailable', detail: getErrorDetail(error) },
        { status: 502 },
      )
    }
  }

  if (!memoryDbDir || !existsSync(memoryDbDir)) {
    return NextResponse.json(
      { error: 'Memory directory not available', agents: [] },
      { status: 404 }
    )
  }

  try {
    const entries = readdirSync(memoryDbDir).filter((f) => f.endsWith('.sqlite'))
    const agents: AgentGraphData[] = []

    for (const entry of entries) {
      const agentName = entry.replace('.sqlite', '')

      if (agentFilter !== 'all' && agentName !== agentFilter) continue

      const dbPath = path.join(memoryDbDir, entry)
      const data = getAgentData(dbPath, agentName)
      if (data) agents.push(data)
    }

    // Sort by total chunks descending
    agents.sort((a, b) => b.totalChunks - a.totalChunks)

    return NextResponse.json({ agents })
  } catch (err) {
    logger.error(`Failed to build memory graph data: ${err}`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
