'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { ArrowsClockwise } from '@phosphor-icons/react'
import { cn } from './cn'

export interface HeaderProps {
  /** Brand label shown next to the mark. */
  brand?: ReactNode
  /** Short brand mark glyph (kept to a single accent character). */
  mark?: ReactNode
  /** Live spot price in USD. Tick-flashes green/red when it changes. */
  price: number | null
  /** Live connection indicator. */
  live?: boolean
  /** Human-readable last-update string (e.g. "12:04:33"). */
  lastUpdated?: string
  onRefresh?: () => void
  refreshing?: boolean
  /** Extra controls rendered before the refresh button. */
  children?: ReactNode
  className?: string
}

/**
 * Header — sticky glass top bar with a tick-flashing live price.
 *
 * The price cell flashes up/down on change (600ms, reduced-motion safe via CSS).
 * Glass blur is applied here only (fixed/sticky) per the perf rules.
 */
export function Header({
  brand = 'BTC NEXUS',
  mark = '₿',
  price,
  live = true,
  lastUpdated,
  onRefresh,
  refreshing = false,
  children,
  className,
}: HeaderProps) {
  const prev = useRef<number | null>(price)
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)
  const [flashKey, setFlashKey] = useState(0)

  useEffect(() => {
    if (price == null) {
      prev.current = null
      return
    }
    const before = prev.current
    if (before != null && price !== before) {
      setFlash(price > before ? 'up' : 'down')
      setFlashKey((k) => k + 1)
    }
    prev.current = price
  }, [price])

  return (
    <header
      className={cn(
        'glass-bar sticky top-0 z-header w-full',
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-4 py-2.5 md:px-6">
        {/* brand */}
        <div className="flex items-center gap-2.5">
          <span
            className="flex items-center justify-center rounded-core border text-[0.95rem] font-bold"
            style={{
              width: 30,
              height: 30,
              background: 'var(--accent-soft)',
              borderColor: 'rgba(247,147,26,0.34)',
              color: 'var(--accent)',
              boxShadow: 'var(--inset-highlight)',
            }}
            aria-hidden
          >
            {mark}
          </span>
          <span className="text-[0.95rem] font-bold tracking-[0.02em] text-ink">{brand}</span>
        </div>

        {/* live price + controls */}
        <div className="flex items-center gap-3 md:gap-4">
          {live && (
            <span className="hidden items-center gap-1.5 sm:flex" aria-label="ライブ接続中">
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className="absolute inline-flex h-full w-full rounded-full"
                  style={{ background: 'var(--up)', animation: 'live-halo 2s ease-out infinite' }}
                />
                <span
                  className="relative inline-flex h-1.5 w-1.5 rounded-full"
                  style={{ background: 'var(--up)', animation: 'live-pulse 2s ease-in-out infinite' }}
                />
              </span>
              <span className="text-2xs font-semibold uppercase tracking-wide2 text-up">LIVE</span>
            </span>
          )}

          <span
            key={flashKey}
            className={cn(
              'tabular rounded-sm px-1.5 font-mono text-[1.15rem] font-bold leading-none',
              flash === 'up' && 'tick-flash-up',
              flash === 'down' && 'tick-flash-down',
            )}
            style={{ color: 'var(--accent)' }}
            aria-live="polite"
            aria-label={price != null ? `現在価格 ${price} ドル` : '価格取得待ち'}
          >
            {price != null ? `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '---'}
          </span>

          {lastUpdated && (
            <span className="hidden text-2xs tabular font-mono text-ink-muted md:inline">
              {lastUpdated}
            </span>
          )}

          {children}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="データを更新"
              className={cn(
                'focus-ring flex items-center justify-center rounded-sm border',
                'transition-[transform,background-color,border-color] duration-150 ease-terminal',
                'hover:bg-accent-soft active:scale-[0.96]',
                'disabled:cursor-not-allowed disabled:opacity-60',
              )}
              style={{ width: 30, height: 30, borderColor: 'var(--hairline-2)', background: 'var(--bg-2)' }}
            >
              <ArrowsClockwise
                size={15}
                weight="bold"
                className={cn('text-ink-dim', refreshing && 'animate-spin')}
                aria-hidden
              />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
