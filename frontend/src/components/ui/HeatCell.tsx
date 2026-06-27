import { type ReactNode, type TdHTMLAttributes } from 'react'
import { cn } from './cn'

export interface HeatCellProps extends Omit<TdHTMLAttributes<HTMLTableCellElement>, 'children'> {
  /** Signed value that drives the tint (e.g. a funding rate). */
  value: number | null | undefined
  /** Rendered content; if omitted, the value is shown via `format`. */
  children?: ReactNode
  /** Magnitude at which the tint reaches full strength. */
  scale?: number
  /** Max background alpha at full strength. */
  maxAlpha?: number
  format?: (v: number | null | undefined) => string
  align?: 'left' | 'right' | 'center'
}

const POS_RGB = '45,190,132' // --up
const NEG_RGB = '240,93,114' // --down

/**
 * HeatCell — funding-rate-style heatmap cell.
 * Background alpha scales with |value| / scale (clamped); hue follows the sign.
 * Text brightens with magnitude so strong cells stay legible on the tint.
 */
export function HeatCell({
  value,
  children,
  scale = 0.0008,
  maxAlpha = 0.28,
  format,
  align = 'right',
  className,
  style,
  ...rest
}: HeatCellProps) {
  const v = value == null || Number.isNaN(value) ? 0 : value
  const magnitude = Math.min(Math.abs(v) / scale, 1)
  const alpha = +(magnitude * maxAlpha).toFixed(3)
  const rgb = v > 0 ? POS_RGB : v < 0 ? NEG_RGB : null

  const background = rgb && alpha > 0 ? `rgba(${rgb},${alpha})` : 'transparent'
  // brighten text from dim -> full token color as magnitude rises
  const color =
    v === 0
      ? 'var(--text-dim)'
      : v > 0
        ? magnitude > 0.45
          ? 'var(--up)'
          : 'rgba(45,190,132,0.78)'
        : magnitude > 0.45
          ? 'var(--down)'
          : 'rgba(240,93,114,0.78)'

  const content = children ?? (format ? format(value) : value ?? '—')

  return (
    <td
      className={cn(
        'tabular px-2.5 py-[7px] font-mono text-[0.78rem] transition-colors duration-150',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
      style={{ background, color, ...style }}
      {...rest}
    >
      {content}
    </td>
  )
}

export default HeatCell
