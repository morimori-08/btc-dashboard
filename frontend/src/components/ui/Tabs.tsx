'use client'

import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { cn } from './cn'

export interface TabItem {
  id: string
  label: ReactNode
  /** Optional icon element (e.g. a Phosphor icon). Shown left of the label. */
  icon?: ReactNode
  content?: ReactNode
  disabled?: boolean
}

export interface TabsProps {
  items: TabItem[]
  /** Controlled active id. */
  value?: string
  /** Uncontrolled initial active id (defaults to first item). */
  defaultValue?: string
  onChange?: (id: string) => void
  /** Make the tab bar sticky with a glass background. */
  sticky?: boolean
  /** Top offset (px) for the sticky bar (e.g. header height). */
  stickyOffset?: number
  /** Render the active item's `content` below the bar, with crossfade. */
  renderContent?: boolean
  className?: string
  ariaLabel?: string
}

/**
 * Tabs — accessible tablist with a sliding active indicator.
 *
 * Keyboard: ArrowLeft/Right move focus+selection, Home/End jump to ends,
 * disabled tabs are skipped. aria-selected / role=tab/tablist/tabpanel set.
 * The indicator animates via transform/width transitions (GPU-safe).
 */
export function Tabs({
  items,
  value,
  defaultValue,
  onChange,
  sticky = false,
  stickyOffset = 0,
  renderContent = true,
  className,
  ariaLabel = 'タブ',
}: TabsProps) {
  const firstEnabled = items.find((t) => !t.disabled)?.id ?? items[0]?.id
  const [internal, setInternal] = useState<string>(defaultValue ?? firstEnabled)
  const active = value ?? internal

  const baseId = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({ left: 0, width: 0 })

  const select = useCallback(
    (id: string) => {
      const item = items.find((t) => t.id === id)
      if (!item || item.disabled) return
      if (value === undefined) setInternal(id)
      onChange?.(id)
    },
    [items, onChange, value],
  )

  // Position the sliding indicator under the active tab.
  const measure = useCallback(() => {
    const el = btnRefs.current[active]
    const list = listRef.current
    if (!el || !list) return
    setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [active])

  useLayoutEffect(() => {
    measure()
  }, [measure, items])

  useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const enabled = items.filter((t) => !t.disabled)
    const idx = enabled.findIndex((t) => t.id === active)
    if (idx < 0) return
    let next = idx
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % enabled.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + enabled.length) % enabled.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = enabled.length - 1
    else return
    e.preventDefault()
    const id = enabled[next].id
    select(id)
    btnRefs.current[id]?.focus()
  }

  const activeItem = items.find((t) => t.id === active)

  return (
    <div className={className}>
      <div
        className={cn(
          'relative',
          sticky && 'glass-bar sticky z-tabbar rounded-panel',
        )}
        style={sticky ? { top: stickyOffset } : undefined}
      >
        <div
          ref={listRef}
          role="tablist"
          aria-label={ariaLabel}
          onKeyDown={onKeyDown}
          className={cn(
            'relative flex items-center gap-1 overflow-x-auto p-1',
            sticky ? '' : 'rounded-panel border border-hairline bg-bg-1',
          )}
          style={{ scrollbarWidth: 'none' }}
        >
          {/* sliding active indicator */}
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-1 top-1 rounded-sm transition-all duration-200 ease-terminal"
            style={{
              left: indicator.left,
              width: indicator.width,
              background: 'var(--accent-soft)',
              border: '1px solid rgba(247,147,26,0.34)',
              opacity: indicator.width ? 1 : 0,
            }}
          />
          {items.map((t) => {
            const selected = t.id === active
            return (
              <button
                key={t.id}
                ref={(el) => {
                  btnRefs.current[t.id] = el
                }}
                role="tab"
                id={`${baseId}-tab-${t.id}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                disabled={t.disabled}
                onClick={() => select(t.id)}
                className={cn(
                  'focus-ring relative z-[1] flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1.5',
                  'text-[0.78rem] font-semibold tracking-[0.02em] transition-colors duration-150 ease-terminal',
                  selected ? 'text-accent' : 'text-ink-dim hover:text-ink',
                  t.disabled && 'cursor-not-allowed opacity-40 hover:text-ink-dim',
                )}
              >
                {t.icon && <span className="flex items-center">{t.icon}</span>}
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {renderContent && activeItem && (
        <div
          key={active}
          role="tabpanel"
          id={`${baseId}-panel-${active}`}
          aria-labelledby={`${baseId}-tab-${active}`}
          tabIndex={0}
          className="tab-crossfade focus-ring mt-3 outline-none"
        >
          {activeItem.content}
        </div>
      )}
    </div>
  )
}

export default Tabs
