import { listTasks } from '@/lib/orca/client'
import type { FrameworkAdapter, AgentRegistration, HeartbeatPayload, TaskReport, Assignment } from './adapter'

export class CorporateVaultAdapter implements FrameworkAdapter {
  readonly framework = 'orca'

  async register(_agent: AgentRegistration): Promise<void> {
    console.debug('[orca-adapter] register not implemented in B.2, use B.2.1')
  }

  async heartbeat(_payload: HeartbeatPayload): Promise<void> {
    console.debug('[orca-adapter] heartbeat not implemented in B.2, use B.2.1')
  }

  async reportTask(_report: TaskReport): Promise<void> {
    console.debug('[orca-adapter] reportTask not implemented in B.2, use B.2.1')
  }

  async getAssignments(agentId: string): Promise<Assignment[]> {
    try {
      const tasks = await listTasks({ agentId, status: 'pending' })
      return tasks.map((task) => {
        const title = typeof task.title === 'string' ? task.title : `Корпоративная задача ${task.id}`
        const descriptionPart = typeof task.description === 'string' ? task.description : ''
        return {
          taskId: task.id,
          description: descriptionPart ? `${title}\n${descriptionPart}` : title,
          metadata: {
            framework: 'orca',
            status: task.status,
            orcaTaskId: task.id,
            raw: task.extra,
          },
        }
      })
    } catch (error: any) {
      console.error(`[orca-adapter] getAssignments failed: ${error?.message || 'unknown error'}`)
      return []
    }
  }

  async disconnect(_agentId: string): Promise<void> {
    console.debug('[orca-adapter] disconnect not implemented in B.2, use B.2.1')
  }
}
