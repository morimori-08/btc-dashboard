import { type ReactNode } from 'react'
import { CaretUp, CaretDown } from '@phosphor-icons/react/dist/ssr'
import { cn, signOf } from './cn'
import { Sparkline, type SparklineProps } from './Sparkline'

export interface MetricProps {
  label: ReactNode
  value: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Signed delta. When provided, colors + arrow are derived from its sign. */
  delta?: number | null
  /** Pre-formatted delta text (e.g. "+2.41%"); falls back to delta.toFixed(2). */
  deltaLabel?: ReactNode
  /** Secondary caption under the value. */
  sub?: ReactNode
  /** Optional inline trend. Pass a number[] for data; tone defaults to delta sign. */
  spark?: number[]
  sparkProps?: Partial<Omit<SparklineProps, 'data'>>
  /** Right-align the block (useful in grids/tables). */
  align?: 'left' | 'right'
  className?: string
}

const VALUE_SIZE: Record<NonNullable<MetricProps['size']>, string> = {
  sm: 'text-[1.05rem]',
  md: 'text-[1.45rem]',
  lg: 'text-[2.1rem]',
}

/**
 * Metric — muted label + mono tabular value + signed delta + optional sparkline.
 * Color is never the sole signal: the delta also carries a directional caret.
 */
export function Metric({
  label,
  value,
  size = 'md',
  delta,
  deltaLabel,
  sub,
  spark,
  sparkProps,
  align = 'left',
  className,
}: MetricProps) {
  const sign = signOf(delta)
  const deltaColor = sign > 0 ? 'text-up' : sign < 0 ? 'text-down' : 'text-ink-muted'
  const Caret = sign > 0 ? CaretUp : sign < 0 ? CaretDown : null

  const deltaText =
    deltaLabel ??
    (delta != null && !Number.isNaN(delta)
      ? `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`
      : null)

  return (
    <div className={cn('flex flex-col gap-1', align === 'right' && 'items-end text-right', className)}>
      <span className="text-2xs font-medium uppercase tracking-label text-ink-muted">{label}</span>

      <div className={cn('flex items-baseline gap-2', align === 'right' && 'flex-row-reverse')}>
        <span className={cn('tabular font-mono font-semibold leading-none text-ink', VALUE_SIZE[size])}>
          {value}
        </span>
        {deltaText != null && (
          <span className={cn('inline-flex items-center gap-0.5 text-[0.72rem] font-semibold tabular', deltaColor)}>
            {Caret && <Caret size={11} weight="bold" aria-hidden />}
            {deltaText}
          </span>
        )}
      </div>

      {(sub || spark) && (
        <div className={cn('flex items-center gap-2', align === 'right' && 'flex-row-reverse')}>
          {sub && <span className="text-2xs text-ink-dim tabular font-mono">{sub}</span>}
          {spark && (
            <Sparkline
              data={spark}
              tone={sign > 0 ? 'up' : sign < 0 ? 'down' : 'neutral'}
              width={64}
              height={18}
              {...sparkProps}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default Metric
