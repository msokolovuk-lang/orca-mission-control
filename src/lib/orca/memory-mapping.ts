interface FileNode {
  path: string
  name: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

type GraphEdge = { source: string; target: string }

interface McGraphAgent {
  id: string
  name: string
  nodes: Array<{ id: string; label: string }>
  edges: GraphEdge[]
  dbSize: number
  totalChunks: number
  totalFiles: number
  files: Array<{ path: string; chunks: number; textSize: number }>
}

function normalizePath(input: string): string {
  return input.replace(/^\/+/, '').replace(/\\/g, '/')
}

function basenameWithoutMd(input: string): string {
  const normalized = normalizePath(input)
  const leaf = normalized.split('/').pop() || normalized
  return leaf.endsWith('.md') ? leaf.slice(0, -3) : leaf
}

function sortTree(nodes: FileNode[]): FileNode[] {
  return nodes
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    .map((node) => (node.children ? { ...node, children: sortTree(node.children) } : node))
}

function ensureDirectory(parent: FileNode, absolutePath: string, name: string): FileNode {
  if (!parent.children) parent.children = []
  const existing = parent.children.find(
    (child) => child.type === 'directory' && child.path === absolutePath,
  )
  if (existing) return existing
  const created: FileNode = { path: absolutePath, name, type: 'directory', children: [] }
  parent.children.push(created)
  return created
}

function includeByCategory(notePath: string, categories: ('all' | 'daily' | 'knowledge')[]): boolean {
  if (categories.includes('all')) return true
  const normalized = normalizePath(notePath)
  if (categories.includes('daily') && normalized.startsWith('daily/')) return true
  if (categories.includes('knowledge') && (normalized.startsWith('policies/') || normalized.startsWith('knowledge/'))) return true
  return false
}

export function brainToMcTree(vault: string, notes: string[]): FileNode[] {
  const root: FileNode = {
    path: vault,
    name: vault,
    type: 'directory',
    children: [],
  }

  const categories: ('all' | 'daily' | 'knowledge')[] = ['all', 'daily', 'knowledge']

  for (const rawNotePath of notes) {
    const notePath = normalizePath(rawNotePath)
    if (!notePath || !includeByCategory(notePath, categories)) continue

    const segments = notePath.split('/').filter(Boolean)
    if (!segments.length) continue

    let cursor = root
    let runningPath = vault
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index]
      runningPath = `${runningPath}/${segment}`
      const isLast = index === segments.length - 1
      if (isLast) {
        if (!cursor.children) cursor.children = []
        cursor.children.push({
          path: runningPath,
          name: segment,
          type: 'file',
        })
      } else {
        cursor = ensureDirectory(cursor, runningPath, segment)
      }
    }
  }

  return sortTree([root])
}

export function brainGraphToMcGraph(
  graph: { nodes: string[]; edges: GraphEdge[] },
  vault: string,
): { agents: McGraphAgent[] } {
  const nodeSet = new Set<string>()
  const nodes = graph.nodes
    .map((rawPath) => normalizePath(rawPath))
    .filter((nodePath) => {
      if (!nodePath || nodeSet.has(nodePath)) return false
      nodeSet.add(nodePath)
      return true
    })
    .map((nodePath) => ({
      id: `${vault}/${nodePath}`,
      label: basenameWithoutMd(nodePath),
    }))

  const allowedIds = new Set(nodes.map((node) => node.id))
  const edges = graph.edges
    .map((edge) => ({
      source: `${vault}/${normalizePath(edge.source)}`,
      target: `${vault}/${normalizePath(edge.target)}`,
    }))
    .filter((edge) => allowedIds.has(edge.source) && allowedIds.has(edge.target))

  const files = nodes.map((node) => ({
    path: node.id,
    chunks: 1,
    textSize: 0,
  }))

  return {
    agents: [
      {
        id: vault,
        name: vault,
        nodes,
        edges,
        dbSize: 0,
        totalChunks: edges.length,
        totalFiles: nodes.length,
        files,
      },
    ],
  }
}
