import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import {
  fetchDelegationLog,
  fetchUsageSummary,
  fetchUsageByAgent,
  fetchUsageByModel,
  fetchUsageDaily,
} from '@/lib/orca/usage'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const action = new URL(request.url).searchParams.get('action') || 'summary'

  try {
    switch (action) {
      case 'delegation-log': {
        const limit = parseInt(new URL(request.url).searchParams.get('limit') || '100')
        const data = await fetchDelegationLog(limit)
        return NextResponse.json({ entries: data, total: data.length })
      }
      case 'summary': {
        const data = await fetchUsageSummary()
        return NextResponse.json(
          data ?? {
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_cost_usd: 0,
            total_records: 0,
          },
        )
      }
      case 'by-agent': {
        const data = await fetchUsageByAgent()
        return NextResponse.json({ entries: data })
      }
      case 'by-model': {
        const data = await fetchUsageByModel()
        return NextResponse.json({ entries: data })
      }
      case 'daily': {
        const data = await fetchUsageDaily()
        return NextResponse.json({ entries: data })
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err) {
    logger.error({ err }, 'GET /api/orca-usage error')
    // Graceful: 200 с пустыми данными, чтобы UI просто показал "нет данных"
    return NextResponse.json({ entries: [], total: 0, error: 'gateway_unavailable' })
  }
}
