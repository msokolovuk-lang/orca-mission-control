import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { syncAll } from '@/lib/orca/sync'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const report = await syncAll()
    return NextResponse.json(report)
  } catch (error: any) {
    logger.error({ err: error }, 'POST /api/orca/sync error')
    return NextResponse.json({ error: error?.message || 'Orca sync failed' }, { status: 500 })
  }
}
