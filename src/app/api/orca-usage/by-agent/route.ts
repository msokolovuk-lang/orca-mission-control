import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { fetchUsageByAgent } from '@/lib/orca/usage'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const entries = await fetchUsageByAgent()
    return NextResponse.json({ entries })
  } catch (err) {
    logger.error({ err }, 'GET /api/orca-usage/by-agent error')
    return NextResponse.json({ entries: [] })
  }
}
