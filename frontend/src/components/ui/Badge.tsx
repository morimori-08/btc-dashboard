import { type ReactNode } from 'react'
import { cn } from './cn'

export type BadgeTone =
  | 'bull'
  | 'bear'
  | 'neutral'
  | 'accent'
  | 'cool'
  | 'up'
  | 'down'
  | 'muted'

export interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  /** Show a small leading status square (semantic state only). */
  dot?: boolean
  size?: 'sm' | 'md'
  className?: string
}

// Square-ish status chips (not pills) per the terminal aesthetic.
const TONE_STYLE: Record<BadgeTone, { color: string; bg: string; border: string }> = {
  bull: { color: 'var(--up)', bg: 'var(--up-soft)', border: 'rgba(45,190,132,0.32)' },
  up: { color: 'var(--up)', bg: 'var(--up-soft)', border: 'rgba(45,190,132,0.32)' },
  bear: { color: 'var(--down)', bg: 'var(--down-soft)', border: 'rgba(240,93,114,0.32)' },
  down: { color: 'var(--down)', bg: 'var(--down-soft)', border: 'rgba(240,93,114,0.32)' },
  neutral: { color: 'var(--text-dim)', bg: 'rgba(255,255,255,0.04)', border: 'var(--hairline-2)' },
  accent: { color: 'var(--accent)', bg: 'var(--accent-soft)', border: 'rgba(247,147,26,0.32)' },
  cool: { color: 'var(--cool)', bg: 'rgba(79,182,199,0.12)', border: 'rgba(79,182,199,0.3)' },
  muted: { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)', border: 'var(--hairline)' },
}

/**
 * Badge — compact square-ish status label.
 * Use for signal states (BULL/BEAR/NEUTRAL) and confidence (STRONG/PLAUSIBLE).
 */
export function Badge({ children, tone = 'neutral', dot = false, size = 'md', className }: BadgeProps) {
  const t = TONE_STYLE[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm font-semibold uppercase tracking-label',
        'border align-middle whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0.5 text-2xs' : 'px-2 py-[3px] text-[0.68rem]',
        className,
      )}
      style={{ color: t.color, background: t.bg, borderColor: t.border }}
    >
      {dot && (
        <span
          aria-hidden
          className="inline-block h-[5px] w-[5px] rounded-[1px]"
          style={{ background: t.color, boxShadow: `0 0 6px ${t.color}66` }}
        />
      )}
      {children}
    </span>
  )
}

export default Badge
