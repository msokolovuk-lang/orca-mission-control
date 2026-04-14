import { eventBus } from '@/lib/event-bus'
import { listTasks } from '@/lib/orca/client'
import type { FrameworkAdapter, AgentRegistration, HeartbeatPayload, TaskReport, Assignment } from './adapter'

export class OrcaAdapter implements FrameworkAdapter {
  readonly framework = 'orca'

  async register(agent: AgentRegistration): Promise<void> {
    eventBus.broadcast('agent.created', {
      id: agent.agentId,
      name: agent.name,
      framework: agent.framework || this.framework,
      status: 'online',
      ...(agent.metadata ?? {}),
    })
  }

  async heartbeat(payload: HeartbeatPayload): Promise<void> {
    eventBus.broadcast('agent.status_changed', {
      id: payload.agentId,
      status: payload.status,
      metrics: payload.metrics ?? {},
      framework: this.framework,
    })
  }

  async reportTask(report: TaskReport): Promise<void> {
    eventBus.broadcast('task.updated', {
      id: report.taskId,
      agentId: report.agentId,
      progress: report.progress,
      status: report.status,
      output: report.output,
      framework: this.framework,
    })
  }

  async getAssignments(agentId: string): Promise<Assignment[]> {
    try {
      const tasks = await listTasks({ agentId, status: 'pending' })
      return tasks.map((task) => {
        const title = typeof task.title === 'string' ? task.title : `Orca task ${task.id}`
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

  async disconnect(agentId: string): Promise<void> {
    eventBus.broadcast('agent.status_changed', {
      id: agentId,
      status: 'offline',
      framework: this.framework,
    })
  }
}
