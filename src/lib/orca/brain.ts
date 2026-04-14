import { orcaFetch } from '@/lib/orca/client'

type BrainRecord = Record<string, unknown>

export interface BrainNotePayload {
  agent_key: string
  path: string
  frontmatter: Record<string, unknown>
  body: string
}

export interface BrainGraphPayload {
  nodes: string[]
  edges: Array<{ source: string; target: string }>
}

function asRecord(value: unknown): BrainRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as BrainRecord)
    : {}
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
}

function readStringList(payload: unknown, key: string): string[] {
  if (Array.isArray(payload)) return toStringList(payload)
  const record = asRecord(payload)
  return toStringList(record[key])
}

function normalizeEdge(edge: unknown): { source: string; target: string } | null {
  const record = asRecord(edge)
  const source = record.source
  const target = record.target
  if (typeof source !== 'string' || typeof target !== 'string') return null
  return { source, target }
}

async function requestFirst<T>(paths: string[]): Promise<T> {
  let lastError: unknown
  for (const candidatePath of paths) {
    try {
      return await orcaFetch<T>(candidatePath)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Orca Brain request failed')
}

export async function listVaults(): Promise<{ vaults: string[] }> {
  const payload = await requestFirst<unknown>([
    '/api/v1/brain/vaults',
    '/api/v1/brain/vault',
  ])
  return { vaults: readStringList(payload, 'vaults') }
}

export async function listNotes(vault: string): Promise<{ notes: string[] }> {
  const encodedVault = encodeURIComponent(vault)
  const payload = await requestFirst<unknown>([
    `/api/v1/brain/vaults/${encodedVault}/notes`,
    `/api/v1/brain/notes?vault=${encodedVault}`,
  ])
  return { notes: readStringList(payload, 'notes') }
}

export async function readNote(vault: string, path: string): Promise<BrainNotePayload> {
  const encodedVault = encodeURIComponent(vault)
  const encodedPath = encodeURIComponent(path)
  const payload = await requestFirst<unknown>([
    `/api/v1/brain/vaults/${encodedVault}/note?path=${encodedPath}`,
    `/api/v1/brain/note?vault=${encodedVault}&path=${encodedPath}`,
  ])

  const record = asRecord(payload)
  const notePayload = asRecord(record.note)
  const agentKey = typeof record.agent_key === 'string' ? record.agent_key : vault
  const notePath = typeof record.path === 'string'
    ? record.path
    : (typeof notePayload.path === 'string' ? notePayload.path : path)
  const body = typeof record.body === 'string'
    ? record.body
    : (typeof notePayload.body === 'string' ? notePayload.body : '')
  const frontmatter = asRecord(record.frontmatter ?? notePayload.frontmatter)

  return {
    agent_key: agentKey,
    path: notePath,
    frontmatter,
    body,
  }
}

export async function getGraph(vault?: string): Promise<BrainGraphPayload> {
  const encodedVault = vault ? encodeURIComponent(vault) : null
  const payload = await requestFirst<unknown>(
    encodedVault
      ? [
          `/api/v1/brain/graph?vault=${encodedVault}`,
          `/api/v1/brain/vaults/${encodedVault}/graph`,
        ]
      : ['/api/v1/brain/graph'],
  )

  const record = asRecord(payload)
  const graphPayload = asRecord(record.graph)
  const nodes = readStringList(payload, 'nodes').length
    ? readStringList(payload, 'nodes')
    : readStringList(graphPayload, 'nodes')
  const rawEdges = Array.isArray(record.edges)
    ? record.edges
    : (Array.isArray(graphPayload.edges) ? graphPayload.edges : [])
  const edges = rawEdges.map(normalizeEdge).filter((edge): edge is { source: string; target: string } => edge !== null)
  return { nodes, edges }
}
