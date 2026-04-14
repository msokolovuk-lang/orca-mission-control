'use client'

import { createElement, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { NavRail } from '@/components/layout/nav-rail'
import { HeaderBar } from '@/components/layout/header-bar'
import { Dashboard } from '@/components/dashboard/dashboard'
import { MemoryBrowserPanel } from '@/components/panels/memory-browser-panel'
import { CostTrackerPanel } from '@/components/panels/cost-tracker-panel'
import { TaskBoardPanel } from '@/components/panels/task-board-panel'
import { ActivityFeedPanel } from '@/components/panels/activity-feed-panel'
import { AgentSquadPanelPhase3 } from '@/components/panels/agent-squad-panel-phase3'
import { OrchestrationBar } from '@/components/panels/orchestration-bar'
import { NotificationsPanel } from '@/components/panels/notifications-panel'
import { UserManagementPanel } from '@/components/panels/user-management-panel'
import { AuditTrailPanel } from '@/components/panels/audit-trail-panel'
import { SettingsPanel } from '@/components/panels/settings-panel'
import { SuperAdminPanel } from '@/components/panels/super-admin-panel'
import { SecurityAuditPanel } from '@/components/panels/security-audit-panel'
import { ChatPagePanel } from '@/components/panels/chat-page-panel'
import { ChatPanel } from '@/components/chat/chat-panel'
import { STORAGE_GATEWAY_URL } from '@/lib/device-identity'
import { getPluginPanel } from '@/lib/plugins'
import { shouldRedirectDashboardToHttps } from '@/lib/browser-security'
import { useTranslations } from 'next-intl'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LocalModeBanner } from '@/components/layout/local-mode-banner'
import { UpdateBanner } from '@/components/layout/update-banner'
import { Loader } from '@/components/ui/loader'
import { ProjectManagerModal } from '@/components/modals/project-manager-modal'
import { ExecApprovalOverlay } from '@/components/modals/exec-approval-overlay'
import { useWebSocket } from '@/lib/websocket'
import { useServerEvents } from '@/lib/use-server-events'
import { completeNavigationTiming } from '@/lib/navigation-metrics'
import { panelHref, useNavigateToPanel } from '@/lib/navigation'
import { Button } from '@/components/ui/button'
import { useMissionControl } from '@/store'

interface GatewaySummary {
  id: number
  is_primary: number
}

const STEP_KEYS = ['auth', 'capabilities', 'config', 'connect', 'agents', 'sessions', 'projects', 'memory', 'skills'] as const

const bootLabelKeys: Record<string, string> = {
  auth: 'authenticatingOperator',
  capabilities: 'detectingStationMode',
  config: 'loadingControlConfig',
  connect: 'connectingRuntimeLinks',
  agents: 'syncingAgentRegistry',
  sessions: 'loadingActiveSessions',
  projects: 'hydratingWorkspaceBoard',
  memory: 'mappingMemoryGraph',
  skills: 'indexingSkillCatalog',
}

function renderPluginPanel(panelId: string) {
  const pluginPanel = getPluginPanel(panelId)
  return pluginPanel ? createElement(pluginPanel) : <Dashboard />
}

export default function Home() {
  const router = useRouter()
  const { connect } = useWebSocket()
  const tb = useTranslations('boot')
  const tc = useTranslations('common')
  const { activeTab, setActiveTab, setCurrentUser, setDashboardMode, setGatewayAvailable, setLocalSessionsAvailable, setCapabilitiesChecked, setSubscription, setDefaultOrgName, setUpdateAvailable, showProjectManagerModal, setShowProjectManagerModal, fetchProjects, setChatPanelOpen, bootComplete, setBootComplete, setAgents, setSessions, setProjects, setInterfaceMode, setMemoryGraphAgents, setSkillsData } = useMissionControl()

  // Sync URL → Zustand activeTab
  const pathname = usePathname()
  const panelFromUrl = pathname === '/' ? 'overview' : pathname.slice(1)
  const normalizedPanel = panelFromUrl === 'sessions' ? 'chat' : panelFromUrl

  useEffect(() => {
    completeNavigationTiming(pathname)
  }, [pathname])

  useEffect(() => {
    completeNavigationTiming(panelHref(activeTab))
  }, [activeTab])

  useEffect(() => {
    setActiveTab(normalizedPanel)
    if (normalizedPanel === 'chat') {
      setChatPanelOpen(false)
    }
    if (panelFromUrl === 'sessions') {
      router.replace('/chat')
    }
  }, [panelFromUrl, normalizedPanel, router, setActiveTab, setChatPanelOpen])

  // Connect to SSE for real-time local DB events (tasks, agents, chat, etc.)
  useServerEvents()
  const [isClient, setIsClient] = useState(false)
  const [stepStatuses, setStepStatuses] = useState<Record<string, 'pending' | 'done'>>(
    () => Object.fromEntries(STEP_KEYS.map(k => [k, 'pending']))
  )

  const initSteps = useMemo(() =>
    STEP_KEYS.map(key => ({
      key,
      label: tb(bootLabelKeys[key] as Parameters<typeof tb>[0]),
      status: stepStatuses[key] || 'pending' as const,
    })),
    [tb, stepStatuses]
  )

  const markStep = (key: string) => {
    setStepStatuses(prev => ({ ...prev, [key]: 'done' }))
  }

  useEffect(() => {
    if (!bootComplete && initSteps.every(s => s.status === 'done')) {
      setBootComplete()
    }
  }, [initSteps, bootComplete, setBootComplete])

  // Security console warning (anti-self-XSS)
  useEffect(() => {
    if (!bootComplete) return
    if (typeof window === 'undefined') return
    const key = 'mc-console-warning'
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')

    console.log(
      '%c  Stop!  ',
      'color: #fff; background: #e53e3e; font-size: 40px; font-weight: bold; padding: 4px 16px; border-radius: 4px;'
    )
    console.log(
      '%cThis is a browser feature intended for developers.\n\nIf someone told you to copy-paste something here to enable a feature or "hack" an account, it is a scam and will give them access to your account.',
      'font-size: 14px; color: #e2e8f0; padding: 8px 0;'
    )
    console.log(
      '%cLearn more: https://en.wikipedia.org/wiki/Self-XSS',
      'font-size: 12px; color: #718096;'
    )
  }, [bootComplete])

  useEffect(() => {
    setIsClient(true)

    if (shouldRedirectDashboardToHttps({
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      forceHttps: process.env.NEXT_PUBLIC_FORCE_HTTPS === '1',
    })) {
      const secureUrl = new URL(window.location.href)
      secureUrl.protocol = 'https:'
      window.location.replace(secureUrl.toString())
      return
    }

    const connectWithEnvFallback = (localGatewayUrl: string | null) => {
      // localStorage user choice takes priority over env vars
      const explicitWsUrl = localGatewayUrl || process.env.NEXT_PUBLIC_GATEWAY_URL || ''
      const gatewayPort = process.env.NEXT_PUBLIC_GATEWAY_PORT || '18789'
      const gatewayHost = process.env.NEXT_PUBLIC_GATEWAY_HOST || window.location.hostname
      const gatewayProto =
        process.env.NEXT_PUBLIC_GATEWAY_PROTOCOL ||
        (window.location.protocol === 'https:' ? 'wss' : 'ws')
      const wsUrl = explicitWsUrl || `${gatewayProto}://${gatewayHost}:${gatewayPort}`
      connect(wsUrl)
    }

    const connectWithPrimaryGateway = async (): Promise<{ attempted: boolean; connected: boolean }> => {
      try {
        const gatewaysRes = await fetch('/api/gateways')
        if (!gatewaysRes.ok) return { attempted: false, connected: false }
        const gatewaysJson = await gatewaysRes.json().catch(() => ({}))
        const gateways = Array.isArray(gatewaysJson?.gateways) ? gatewaysJson.gateways as GatewaySummary[] : []
        if (gateways.length === 0) return { attempted: false, connected: false }

        const primaryGateway = gateways.find(gw => Number(gw?.is_primary) === 1) || gateways[0]
        if (!primaryGateway?.id) return { attempted: true, connected: false }

        const connectRes = await fetch('/api/gateways/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: primaryGateway.id }),
        })
        if (!connectRes.ok) return { attempted: true, connected: false }

        const payload = await connectRes.json().catch(() => ({}))
        const wsUrl = typeof payload?.ws_url === 'string' ? payload.ws_url : ''
        const wsToken = typeof payload?.token === 'string' ? payload.token : ''
        if (!wsUrl) return { attempted: true, connected: false }

        connect(wsUrl, wsToken)
        return { attempted: true, connected: true }
      } catch {
        return { attempted: false, connected: false }
      }
    }

    // Fetch current user
    fetch('/api/auth/me')
      .then(async (res) => {
        if (res.ok) return res.json()
        if (res.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`)
        }
        return null
      })
      .then(data => { if (data?.user) setCurrentUser(data.user); markStep('auth') })
      .catch(() => { markStep('auth') })

    // Check for available updates
    fetch('/api/releases/check')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.updateAvailable) {
          setUpdateAvailable({
            latestVersion: data.latestVersion,
            releaseUrl: data.releaseUrl,
            releaseNotes: data.releaseNotes,
          })
        }
      })
      .catch(() => {})

    // Check capabilities, then conditionally connect to gateway
    fetch('/api/status?action=capabilities')
      .then(res => res.ok ? res.json() : null)
      .then(async data => {
        const localGatewayUrl = localStorage.getItem(STORAGE_GATEWAY_URL)

        if (data?.subscription) {
          setSubscription(data.subscription)
        }
        if (data?.processUser) {
          setDefaultOrgName(data.processUser)
        }
        if (data?.interfaceMode === 'essential' || data?.interfaceMode === 'full') {
          setInterfaceMode(data.interfaceMode)
        }

        // User's explicit gateway URL choice (localStorage) takes PRIORITY over server's gateway flag.
        // If user chose a URL from login page, always connect to it.
        if (localGatewayUrl) {
          // User explicitly chose a gateway URL — always set full mode
          setDashboardMode('full')
          setGatewayAvailable(true)
          if (data?.claudeHome) {
            setLocalSessionsAvailable(true)
          }
          setCapabilitiesChecked(true)
          markStep('capabilities')
          connect(localGatewayUrl)
          markStep('connect')
          return
        }

        // No user-chosen URL — use server's gateway flag to decide
        if (data && data.gateway === false) {
          setDashboardMode('local')
          setGatewayAvailable(false)
          setCapabilitiesChecked(true)
          markStep('capabilities')
          markStep('connect')
          // Skip WebSocket connect — no gateway to talk to
          return
        }
        if (data && data.gateway === true) {
          setDashboardMode('full')
          setGatewayAvailable(true)
        }
        if (data?.claudeHome) {
          setLocalSessionsAvailable(true)
        }
        setCapabilitiesChecked(true)
        markStep('capabilities')

        // No user choice + server gateway flag false → try primary gateway / env fallback
        const primaryConnect = await connectWithPrimaryGateway()
        if (!primaryConnect.connected && !primaryConnect.attempted) {
          connectWithEnvFallback(null)
        }
        markStep('connect')
      })
      .catch(() => {
        // If capabilities check fails, still try to connect
        setCapabilitiesChecked(true)
        markStep('capabilities')
        markStep('connect')
        connectWithEnvFallback(null)
      })

    markStep('config')
    // Preload workspace data in parallel
    Promise.allSettled([
      fetch('/api/agents')
        .then(r => r.ok ? r.json() : null)
        .then((agentsData) => {
          if (agentsData?.agents) setAgents(agentsData.agents)
        })
        .finally(() => { markStep('agents') }),
      // Sessions can be slow with many JSONL files — don't block boot
      (() => {
        markStep('sessions')
        return fetch('/api/sessions')
          .then(r => r.ok ? r.json() : null)
          .then((sessionsData) => {
            if (sessionsData?.sessions) setSessions(sessionsData.sessions)
          })
      })(),
      fetch('/api/projects')
        .then(r => r.ok ? r.json() : null)
        .then((projectsData) => {
          if (projectsData?.projects) setProjects(projectsData.projects)
        })
        .finally(() => { markStep('projects') }),
      // Memory graph can be slow — don't block boot
      (() => {
        markStep('memory')
        return fetch('/api/memory/graph?agent=all')
          .then(r => r.ok ? r.json() : null)
          .then((graphData) => {
            if (graphData?.agents) setMemoryGraphAgents(graphData.agents)
          })
      })(),
      fetch('/api/skills')
        .then(r => r.ok ? r.json() : null)
        .then((skillsData) => {
          if (skillsData?.skills) setSkillsData(skillsData.skills, skillsData.groups || [], skillsData.total || 0)
        })
        .finally(() => { markStep('skills') }),
    ]).catch(() => { /* panels will lazy-load as fallback */ })

  // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once on mount, not on every pathname change
  }, [connect, router, setCurrentUser, setDashboardMode, setGatewayAvailable, setLocalSessionsAvailable, setCapabilitiesChecked, setSubscription, setUpdateAvailable, setAgents, setSessions, setProjects, setInterfaceMode, setMemoryGraphAgents, setSkillsData])

  if (!isClient || !bootComplete) {
    return <Loader variant="page" steps={isClient ? initSteps : undefined} />
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-medium">
        {tc('skipToMainContent')}
      </a>

      {/* Left: Icon rail navigation (hidden on mobile, shown as bottom bar instead) */}
      <NavRail />

      {/* Center: Header + Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <HeaderBar />
        <LocalModeBanner />
        <UpdateBanner />
        <main
          id="main-content"
          className="flex-1 overflow-auto pb-16 md:pb-0"
          role="main"
        >
          <div aria-live="polite" className="flex flex-col min-h-full">
            <ErrorBoundary key={activeTab}>
              <ContentRouter tab={activeTab} />
            </ErrorBoundary>
          </div>
{/* Footer removed — attribution moved to nav sidebar */}
        </main>
      </div>

      {/* Chat panel overlay */}
      <ChatPanel />

      {/* Global exec approval overlay (shown regardless of active panel) */}
      <ExecApprovalOverlay />

      {/* Global Project Manager Modal */}
      {showProjectManagerModal && (
        <ProjectManagerModal
          onClose={() => setShowProjectManagerModal(false)}
          onChanged={async () => { await fetchProjects() }}
        />
      )}
    </div>
  )
}

const ESSENTIAL_PANELS = new Set([
  'overview', 'agents', 'tasks', 'chat', 'memory', 'activity', 'cost-tracker', 'notifications', 'settings',
])

function ContentRouter({ tab }: { tab: string }) {
  const tp = useTranslations('page')
  const { interfaceMode, setInterfaceMode } = useMissionControl()
  const navigateToPanel = useNavigateToPanel()
  const panelName = tab.replace(/-/g, ' ')

  // Guard: show nudge for non-essential panels in essential mode
  if (interfaceMode === 'essential' && !ESSENTIAL_PANELS.has(tab)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <p className="text-sm text-muted-foreground">
          {tp('availableInFullMode', { panel: panelName })}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setInterfaceMode('full')
              try { await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: { 'general.interface_mode': 'full' } }) }) } catch {}
            }}
          >
            {tp('switchToFull')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateToPanel('overview')}
          >
            {tp('goToOverview')}
          </Button>
        </div>
      </div>
    )
  }

  switch (tab) {
    case 'overview':
      return <Dashboard />
    case 'tasks':
      return <TaskBoardPanel />
    case 'agents':
      return (
        <>
          <OrchestrationBar />
          <AgentSquadPanelPhase3 />
        </>
      )
    case 'notifications':
      return <NotificationsPanel />
    case 'sessions':
      return <ChatPagePanel />
    case 'memory':
      return <MemoryBrowserPanel />
    case 'cost-tracker':
    case 'tokens':
    case 'agent-costs':
      return <CostTrackerPanel />
    case 'users':
      return <UserManagementPanel />
    case 'history':
    case 'activity':
      return <ActivityFeedPanel />
    case 'audit':
      return <AuditTrailPanel />
    case 'settings':
      return <SettingsPanel />
    case 'super-admin':
      return <SuperAdminPanel />
    case 'security':
      return <SecurityAuditPanel />
    case 'chat':
      return <ChatPagePanel />
    default: {
      return renderPluginPanel(tab)
    }
  }
}
