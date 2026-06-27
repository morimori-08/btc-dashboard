import { cn } from './cn'

export interface SkeletonProps {
  className?: string
  /** Width as a CSS value (e.g. '60%', 120). */
  w?: string | number
  /** Height as a CSS value. */
  h?: string | number
  rounded?: 'sm' | 'core' | 'panel' | 'pill' | 'full'
}

const ROUNDED: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  sm: 'rounded-sm',
  core: 'rounded-core',
  panel: 'rounded-panel',
  pill: 'rounded-pill',
  full: 'rounded-full',
}

/**
 * Skeleton — shape-matched loading placeholder (shimmer via CSS, reduced-motion safe).
 */
export function Skeleton({ className, w, h = 12, rounded = 'sm' }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={cn('skeleton-shimmer block', ROUNDED[rounded], className)}
      style={{ width: w, height: h }}
    />
  )
}

/** A skeleton shaped like a Metric block (label + value + sub). */
export function MetricSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-busy="true" aria-label="読み込み中">
      <Skeleton w="42%" h={9} />
      <Skeleton w="68%" h={22} rounded="core" />
      <Skeleton w="34%" h={9} />
    </div>
  )
}

/** A skeleton shaped like N table rows. */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex flex-col" aria-busy="true" aria-label="テーブル読み込み中">
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-3 border-b border-hairline py-[9px] last:border-b-0"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} h={11} w={c === 0 ? '24%' : `${Math.round(60 / cols)}%`} className="flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export default Skeleton
