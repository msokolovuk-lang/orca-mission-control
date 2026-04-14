import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getOrcaBaseUrl, pingOrca } from '@/lib/orca/client'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const baseUrl = getOrcaBaseUrl()
  const ping = await pingOrca()

  if (!ping.ok) {
    return NextResponse.json({
      connected: false,
      latencyMs: ping.latencyMs,
      baseUrl,
      error: ping.error,
    })
  }

  return NextResponse.json({
    connected: true,
    latencyMs: ping.latencyMs,
    baseUrl,
  })
}
