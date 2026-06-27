import { type ReactNode } from 'react'
import { cn } from './cn'

export interface PanelProps {
  children: ReactNode
  /** Optional panel title shown in a hairline-divided header strip. */
  title?: ReactNode
  /** Optional right-aligned slot in the header (e.g. a Badge or control). */
  action?: ReactNode
  /** Accent the left edge + title with the brand accent. */
  accent?: boolean
  /** Tighter inner padding for high-density data. */
  dense?: boolean
  /** Subtle hover lift (use for clickable/interactive panels). */
  hover?: boolean
  className?: string
  /** Applied to the inner core (content) wrapper. */
  bodyClassName?: string
  id?: string
}

/**
 * Panel — the design system's primary container.
 *
 * Double-bezel ("Doppelrand") materiality:
 *   outer shell : glass tint + hairline + 5px padding + rounded-panel
 *   inner core  : bg-1 + inset top highlight + rounded-core (concentric)
 *
 * Server-safe. Hover lift and transitions are pure CSS (honors reduced motion).
 */
export function Panel({
  children,
  title,
  action,
  accent = false,
  dense = false,
  hover = false,
  className,
  bodyClassName,
  id,
}: PanelProps) {
  return (
    <section
      id={id}
      className={cn(
        'group relative rounded-panel p-[5px]',
        'surface-glass border border-hairline shadow-soft',
        'transition-[transform,box-shadow,border-color] duration-200 ease-terminal',
        hover && 'hover:-translate-y-px hover:border-hairline-2 hover:shadow-panel',
        className,
      )}
      style={{ backdropFilter: 'none' }}
    >
      {accent && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-[14px] bottom-[14px] w-[2px] rounded-pill"
          style={{ background: 'var(--accent)', boxShadow: '0 0 10px var(--accent-soft)' }}
        />
      )}
      <div
        className={cn(
          'relative overflow-hidden rounded-core bg-bg-1',
          'shadow-inset-hi',
        )}
      >
        {(title || action) && (
          <header
            className={cn(
              'flex items-center justify-between gap-3 border-b border-hairline',
              dense ? 'px-3 py-2' : 'px-4 py-2.5',
            )}
          >
            {title ? (
              <h3
                className={cn(
                  'text-2xs font-medium uppercase tracking-label',
                  accent ? 'text-accent' : 'text-ink-dim',
                )}
              >
                {title}
              </h3>
            ) : (
              <span />
            )}
            {action ? <div className="flex items-center gap-2">{action}</div> : null}
          </header>
        )}
        <div className={cn(dense ? 'p-3' : 'p-4', bodyClassName)}>{children}</div>
      </div>
    </section>
  )
}

export default Panel
