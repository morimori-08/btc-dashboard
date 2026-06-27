import { type ReactNode } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react/dist/ssr'
import { type Icon } from '@phosphor-icons/react'
import { cn } from './cn'

export interface EmptyStateProps {
  title?: ReactNode
  description?: ReactNode
  /** Phosphor icon component (Light weight applied here). Defaults to MagnifyingGlass. */
  icon?: Icon
  action?: ReactNode
  className?: string
  compact?: boolean
}

/**
 * EmptyState — composed "nothing here yet" view. Never a blank panel.
 */
export function EmptyState({
  title = 'データなし',
  description = '表示できる項目がありません。',
  icon: Icon = MagnifyingGlass,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 py-6' : 'gap-3 py-12',
        className,
      )}
    >
      <span
        className="flex items-center justify-center rounded-core border border-hairline"
        style={{ width: 40, height: 40, background: 'var(--bg-2)' }}
      >
        <Icon size={18} weight="light" className="text-ink-muted" />
      </span>
      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
        <p className="max-w-[36ch] text-2xs leading-relaxed text-ink-dim">{description}</p>
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

export default EmptyState
