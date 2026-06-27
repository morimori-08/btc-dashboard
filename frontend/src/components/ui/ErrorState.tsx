'use client'

import { type ReactNode } from 'react'
import { WarningCircle, ArrowsClockwise } from '@phosphor-icons/react'
import { cn } from './cn'

export interface ErrorStateProps {
  title?: ReactNode
  /** Direct, active-voice message. Default targets the 60s refresh failure. */
  message?: ReactNode
  /** Last successful update time, surfaced so stale data is honest. */
  lastUpdated?: string
  onRetry?: () => void
  retrying?: boolean
  className?: string
  compact?: boolean
}

/**
 * ErrorState — inline failure surface for the periodic-refresh path.
 * Confident, direct copy. The retry button has hover / active / focus states.
 */
export function ErrorState({
  title = '更新に失敗しました',
  message = 'データを取得できませんでした。接続を確認して、もう一度お試しください。',
  lastUpdated,
  onRetry,
  retrying = false,
  className,
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 py-6' : 'gap-3 py-10',
        className,
      )}
    >
      <span
        className="flex items-center justify-center rounded-core border"
        style={{ width: 40, height: 40, background: 'var(--down-soft)', borderColor: 'rgba(240,93,114,0.32)' }}
      >
        <WarningCircle size={20} weight="light" style={{ color: 'var(--down)' }} />
      </span>

      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
        <p className="max-w-[40ch] text-2xs leading-relaxed text-ink-dim">{message}</p>
        {lastUpdated && (
          <p className="mt-0.5 text-2xs tabular font-mono text-ink-muted">
            最終更新: {lastUpdated}
          </p>
        )}
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className={cn(
            'focus-ring mt-1 inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5',
            'text-2xs font-semibold uppercase tracking-label text-ink',
            'transition-[transform,background-color,border-color] duration-150 ease-terminal',
            'hover:bg-accent-soft hover:border-hairline-2 active:scale-[0.98]',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
          style={{ borderColor: 'var(--hairline-2)', background: 'var(--bg-2)' }}
        >
          <ArrowsClockwise
            size={13}
            weight="bold"
            className={retrying ? 'animate-spin' : undefined}
            aria-hidden
          />
          {retrying ? '再試行中' : '再試行'}
        </button>
      )}
    </div>
  )
}

export default ErrorState
