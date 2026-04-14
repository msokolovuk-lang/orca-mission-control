import { cn } from '@/lib/utils'

type WordmarkProps = {
  className?: string
}

export function Wordmark({ className }: WordmarkProps) {
  return (
    <span className={cn('font-mono font-bold text-[#0CBCCE] tracking-wide', className)}>
      ИИ-Ателье
    </span>
  )
}
