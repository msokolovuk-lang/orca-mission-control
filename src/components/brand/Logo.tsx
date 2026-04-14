import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'

type LogoProps = {
  compact?: boolean
  className?: string
}

export function Logo({ compact = false, className }: LogoProps) {
  if (compact) {
    return (
      <span className={cn('inline-flex items-center leading-none', className)}>
        <span className="font-mono font-bold text-[#0CBCCE]">ИИ</span>
      </span>
    )
  }

  return (
    <div className={cn('inline-flex flex-col leading-none', className)}>
      <span className="font-mono text-[#0CBCCE] font-bold tracking-wide uppercase">ИИ-АТЕЛЬЕ</span>
      <span className="font-sans italic text-sm text-gray-400 mt-1">{BRAND.tagline}</span>
    </div>
  )
}
