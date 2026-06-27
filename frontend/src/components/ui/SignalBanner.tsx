import { TrendUp, TrendDown, Minus } from '@phosphor-icons/react/dist/ssr'
import { type Icon } from '@phosphor-icons/react'
import { cn } from './cn'
import { Badge } from './Badge'

export type Signal = 'BULL' | 'BEAR' | 'NEUTRAL'

export interface SignalBannerProps {
  signal: Signal
  /** Composite score, e.g. -3.0 .. +3.0. */
  score: number
  /** Max absolute score for the "/N" suffix. */
  scoreMax?: number
  /** Spot price in USD. */
  price: number | null
  /** Optional confidence tag rendered as a Badge. */
  confidence?: 'STRONG' | 'PLAUSIBLE'
  loading?: boolean
  className?: string
}

const CONFIG: Record<
  Signal,
  { label: string; rgb: string; color: string; Icon: Icon }
> = {
  BULL: { label: 'BULL', rgb: '45,190,132', color: 'var(--up)', Icon: TrendUp },
  BEAR: { label: 'BEAR', rgb: '240,93,114', color: 'var(--down)', Icon: TrendDown },
  NEUTRAL: { label: 'NEUTRAL', rgb: '247,147,26', color: 'var(--accent)', Icon: Minus },
}

/**
 * SignalBanner — composite market-signal header: state icon + score + spot price.
 * Tinted soft fill + hairline + a colored left edge (no neon glow). Mono price.
 */
export function SignalBanner({
  signal,
  score,
  scoreMax = 3,
  price,
  confidence,
  loading = false,
  className,
}: SignalBannerProps) {
  const c = CONFIG[signal] ?? CONFIG.NEUTRAL
  const Icon = c.Icon

  return (
    <div
      className={cn(
        'relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-panel border px-4 py-3',
        className,
      )}
      style={{
        background: `linear-gradient(135deg, rgba(${c.rgb},0.07) 0%, rgba(${c.rgb},0.02) 60%, transparent 100%)`,
        borderColor: `rgba(${c.rgb},0.26)`,
        boxShadow: 'var(--shadow-soft), var(--inset-highlight)',
      }}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: c.color }} />

      <div className="flex items-center gap-3">
        <span
          className="flex items-center justify-center rounded-core border"
          style={{ width: 38, height: 38, background: `rgba(${c.rgb},0.12)`, borderColor: `rgba(${c.rgb},0.3)`, color: c.color }}
        >
          <Icon size={20} weight="bold" />
        </span>

        <div className="flex flex-col gap-1">
          <span className="text-2xs font-medium uppercase tracking-label text-ink-muted">市場シグナル</span>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold leading-none" style={{ color: c.color }}>
              {c.label}
            </span>
            {confidence && (
              <Badge tone={confidence === 'STRONG' ? (signal === 'BEAR' ? 'bear' : signal === 'BULL' ? 'bull' : 'accent') : 'muted'} size="sm">
                {confidence}
              </Badge>
            )}
          </div>
        </div>

        <span aria-hidden className="mx-1 h-8 w-px" style={{ background: 'var(--hairline-2)' }} />

        <div className="flex flex-col gap-1">
          <span className="text-2xs font-medium uppercase tracking-label text-ink-muted">スコア</span>
          <span className="tabular font-mono text-[0.95rem] font-bold text-ink">
            {score > 0 ? '+' : ''}
            {score.toFixed(1)}
            <span className="ml-0.5 text-2xs text-ink-muted">/{scoreMax.toFixed(1)}</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <span className="live-dot" aria-hidden />
        <span className="tabular font-mono text-[1.5rem] font-bold leading-none" style={{ color: 'var(--accent)' }}>
          {price != null
            ? `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
            : loading
              ? '---'
              : 'N/A'}
        </span>
      </div>
    </div>
  )
}

export default SignalBanner
