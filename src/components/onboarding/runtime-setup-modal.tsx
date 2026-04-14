'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

interface RuntimeSetupModalProps {
  runtime: 'openclaw' | 'claude' | 'codex'
  onClose: () => void
  onComplete: () => void
}

export function RuntimeSetupModal({ runtime, onClose, onComplete }: RuntimeSetupModalProps) {
  const SetupComponent = {
    openclaw: OpenClawSetup,
    claude: ClaudeSetup,
    codex: CodexSetup,
  }[runtime]

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-card border border-border rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl shadow-black/30">
        <SetupComponent onClose={onClose} onComplete={onComplete} />
      </div>
    </div>
  )
}

// ─── Agent gateway setup ─────────────────────────────────────────────────

function OpenClawSetup({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const [step, setStep] = useState<'onboard' | 'verify' | 'done'>('onboard')
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [healthStatus, setHealthStatus] = useState<any>(null)

  const runOnboard = useCallback(async () => {
    setRunning(true)
    setError(null)
    setOutput('')
    try {
      const res = await fetch('/api/agent-runtimes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'install', runtime: 'openclaw', mode: 'local' }),
      })
      // The onboard command runs as part of post-install in agent-runtimes.ts
      // Let's use the doctor endpoint to check health instead
      const doctorRes = await fetch('/api/openclaw/doctor')
      if (doctorRes.ok) {
        const data = await doctorRes.json()
        setHealthStatus(data)
        if (data.healthy) {
          setStep('done')
        } else {
          setStep('verify')
          setOutput(data.issues?.join('\n') || 'Some issues detected')
        }
      } else {
        setStep('verify')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setRunning(false)
    }
  }, [])

  const runDoctorFix = useCallback(async () => {
    setRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/openclaw/doctor', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setStep('done')
          setOutput('All issues resolved')
        } else {
          setOutput(data.output || 'Fix attempt completed with warnings')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Doctor fix failed')
    } finally {
      setRunning(false)
    }
  }, [])

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/openclaw/doctor')
      if (res.ok) {
        const data = await res.json()
        setHealthStatus(data)
        if (data.healthy) setStep('done')
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => { checkHealth() }, [checkHealth])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Настройка агентского шлюза</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Настройте шлюз и проверьте подключение</p>
        </div>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-6">
        {(['onboard', 'verify', 'done'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
              step === s ? 'bg-primary text-primary-foreground' :
              (['onboard', 'verify', 'done'].indexOf(step) > i) ? 'bg-green-500/20 text-green-400' :
              'bg-secondary text-muted-foreground'
            }`}>
              {(['onboard', 'verify', 'done'].indexOf(step) > i) ? (
                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 8.5l3.5 3.5 6.5-8" /></svg>
              ) : i + 1}
            </div>
            {i < 2 && <div className={`w-8 h-px ${(['onboard', 'verify', 'done'].indexOf(step) > i) ? 'bg-green-500/40' : 'bg-border/30'}`} />}
          </div>
        ))}
      </div>

      {step === 'onboard' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-border/30 bg-secondary/20 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-lg">1</span>
              <div>
                <p className="text-sm font-medium">Health Check</p>
                <p className="text-xs text-muted-foreground">Запустите диагностику шлюза, чтобы проверить конфигурацию и связь.</p>
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          {healthStatus?.healthy && (
            <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/5 text-xs text-green-400">
              Шлюз в порядке и корректно настроен.
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Skip</Button>
            <Button size="sm" onClick={runOnboard} disabled={running}>
              {running ? 'Checking...' : 'Run Health Check'}
            </Button>
          </div>
        </div>
      )}

      {step === 'verify' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-2">
            <p className="text-sm font-medium text-amber-400">Issues Detected</p>
            {healthStatus?.issues?.map((issue: string, i: number) => (
              <p key={i} className="text-xs text-muted-foreground">- {issue}</p>
            ))}
            {output && <pre className="text-xs text-muted-foreground/70 whitespace-pre-wrap mt-2">{output}</pre>}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Skip for now</Button>
            <Button size="sm" onClick={runDoctorFix} disabled={running}>
              {running ? 'Fixing...' : 'Auto-Fix Issues'}
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/5 text-center space-y-2">
            <div className="text-2xl">+</div>
            <p className="text-sm font-medium text-green-400">Шлюз готов к работе</p>
            <p className="text-xs text-muted-foreground">Gateway is configured and healthy. Agents can now connect.</p>
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={onComplete}>Done</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Claude Code Setup ──────────────────────────────────────────────────

function ClaudeSetup({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const [step, setStep] = useState<'check' | 'auth' | 'done'>('check')
  const [checking, setChecking] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [version, setVersion] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkAuth = useCallback(async () => {
    setChecking(true)
    setError(null)
    try {
      const res = await fetch('/api/agent-runtimes')
      if (res.ok) {
        const data = await res.json()
        const claude = (data.runtimes || []).find((r: any) => r.id === 'claude')
        if (claude) {
          setAuthenticated(claude.authenticated)
          setVersion(claude.version)
          if (claude.authenticated) setStep('done')
          else setStep('auth')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed')
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => { checkAuth() }, [checkAuth])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Set Up Claude Code</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Authenticate the Anthropic CLI agent</p>
        </div>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-6">
        {(['check', 'auth', 'done'] as const).map((s, i) => {
          const labels = ['Check', 'Authenticate', 'Ready']
          const currentIdx = (['check', 'auth', 'done'] as const).indexOf(step)
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step === s ? 'bg-primary text-primary-foreground' :
                currentIdx > i ? 'bg-green-500/20 text-green-400' :
                'bg-secondary text-muted-foreground'
              }`}>
                {currentIdx > i ? (
                  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 8.5l3.5 3.5 6.5-8" /></svg>
                ) : i + 1}
              </div>
              <span className={`text-[10px] ${step === s ? 'text-foreground' : 'text-muted-foreground/40'}`}>{labels[i]}</span>
              {i < 2 && <div className={`w-4 h-px ${currentIdx > i ? 'bg-green-500/40' : 'bg-border/20'}`} />}
            </div>
          )
        })}
      </div>

      {step === 'check' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-border/30 bg-secondary/20">
            <p className="text-sm font-medium">Checking authentication status...</p>
            <p className="text-xs text-muted-foreground mt-1">Verifying Claude Code credentials.</p>
          </div>
          {checking && <div className="flex items-center gap-2 text-xs text-muted-foreground"><div className="w-3 h-3 rounded-full border-2 border-primary/20 border-t-primary animate-spin" /> Checking...</div>}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}

      {step === 'auth' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-3">
            <p className="text-sm font-medium text-amber-400">Authentication Required</p>
            <p className="text-xs text-muted-foreground">
              Claude Code {version ? `(v${version})` : ''} is installed but not authenticated.
            </p>
            <div className="p-3 rounded bg-black/20 border border-border/20">
              <p className="text-xs text-muted-foreground mb-1.5">Run this command in your terminal:</p>
              <code className="block font-mono text-sm text-foreground select-all">claude login</code>
            </div>
            <p className="text-xs text-muted-foreground">
              This opens a browser for OAuth login with your Anthropic account, or you can set <code className="text-[11px] bg-black/20 px-1 rounded">ANTHROPIC_API_KEY</code> in your environment.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Skip</Button>
            <Button size="sm" onClick={checkAuth} disabled={checking}>
              {checking ? 'Checking...' : 'I\'ve logged in — verify'}
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/5 text-center space-y-2">
            <div className="text-2xl">+</div>
            <p className="text-sm font-medium text-green-400">Claude Code is ready</p>
            <p className="text-xs text-muted-foreground">Authenticated and available for agent tasks.</p>
            {version && <p className="text-2xs text-muted-foreground/60">v{version}</p>}
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={onComplete}>Done</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Codex CLI Setup ────────────────────────────────────────────────────

function CodexSetup({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const [step, setStep] = useState<'check' | 'auth' | 'done'>('check')
  const [checking, setChecking] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [version, setVersion] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkAuth = useCallback(async () => {
    setChecking(true)
    setError(null)
    try {
      const res = await fetch('/api/agent-runtimes')
      if (res.ok) {
        const data = await res.json()
        const codex = (data.runtimes || []).find((r: any) => r.id === 'codex')
        if (codex) {
          setAuthenticated(codex.authenticated)
          setVersion(codex.version)
          if (codex.authenticated) setStep('done')
          else setStep('auth')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed')
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => { checkAuth() }, [checkAuth])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Set Up Codex CLI</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Authenticate the OpenAI CLI agent</p>
        </div>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-6">
        {(['check', 'auth', 'done'] as const).map((s, i) => {
          const labels = ['Check', 'Authenticate', 'Ready']
          const currentIdx = (['check', 'auth', 'done'] as const).indexOf(step)
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step === s ? 'bg-primary text-primary-foreground' :
                currentIdx > i ? 'bg-green-500/20 text-green-400' :
                'bg-secondary text-muted-foreground'
              }`}>
                {currentIdx > i ? (
                  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 8.5l3.5 3.5 6.5-8" /></svg>
                ) : i + 1}
              </div>
              <span className={`text-[10px] ${step === s ? 'text-foreground' : 'text-muted-foreground/40'}`}>{labels[i]}</span>
              {i < 2 && <div className={`w-4 h-px ${currentIdx > i ? 'bg-green-500/40' : 'bg-border/20'}`} />}
            </div>
          )
        })}
      </div>

      {step === 'check' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-border/30 bg-secondary/20">
            <p className="text-sm font-medium">Checking authentication status...</p>
            <p className="text-xs text-muted-foreground mt-1">Verifying Codex CLI credentials.</p>
          </div>
          {checking && <div className="flex items-center gap-2 text-xs text-muted-foreground"><div className="w-3 h-3 rounded-full border-2 border-primary/20 border-t-primary animate-spin" /> Checking...</div>}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}

      {step === 'auth' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-3">
            <p className="text-sm font-medium text-amber-400">Authentication Required</p>
            <p className="text-xs text-muted-foreground">
              Codex CLI {version ? `(v${version})` : ''} is installed but not authenticated.
            </p>
            <div className="p-3 rounded bg-black/20 border border-border/20">
              <p className="text-xs text-muted-foreground mb-1.5">Run this command in your terminal:</p>
              <code className="block font-mono text-sm text-foreground select-all">codex auth</code>
            </div>
            <p className="text-xs text-muted-foreground">
              This authenticates with your OpenAI account, or you can set <code className="text-[11px] bg-black/20 px-1 rounded">OPENAI_API_KEY</code> in your environment.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Skip</Button>
            <Button size="sm" onClick={checkAuth} disabled={checking}>
              {checking ? 'Checking...' : 'I\'ve authenticated — verify'}
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/5 text-center space-y-2">
            <div className="text-2xl">+</div>
            <p className="text-sm font-medium text-green-400">Codex CLI is ready</p>
            <p className="text-xs text-muted-foreground">Authenticated and available for agent tasks.</p>
            {version && <p className="text-2xs text-muted-foreground/60">v{version}</p>}
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={onComplete}>Done</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusCard({ label, ok, value, subtitle }: { label: string; ok?: boolean; value?: number; subtitle?: string }) {
  return (
    <div className={`p-2.5 rounded-lg border text-xs ${
      ok ? 'border-green-500/20 bg-green-500/5' : 'border-border/20 bg-secondary/10'
    }`}>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{label}</span>
        {value !== undefined ? (
          <span className="font-mono text-foreground">{value}</span>
        ) : (
          <span className={ok ? 'text-green-400' : 'text-muted-foreground/40'}>
            {ok ? '+' : '-'}
          </span>
        )}
      </div>
      {subtitle && <p className="text-[10px] text-muted-foreground/40 mt-0.5">{subtitle}</p>}
    </div>
  )
}
