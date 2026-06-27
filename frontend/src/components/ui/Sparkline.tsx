import { type Tone, TONE_COLOR_VAR } from './cn'

export interface SparklineProps {
  /** Series of values, oldest first. Needs >= 2 points to draw a line. */
  data: number[]
  width?: number
  height?: number
  /** Color tone. 'auto' derives up/down from first-vs-last delta. */
  tone?: Tone | 'auto'
  /** Render a soft filled area under the line. */
  area?: boolean
  strokeWidth?: number
  className?: string
  'aria-label'?: string
}

/**
 * Sparkline — a compact inline trend line built from a number[].
 * Deterministic (server-safe). Tone-colored via design tokens.
 */
export function Sparkline({
  data,
  width = 72,
  height = 22,
  tone = 'auto',
  area = true,
  strokeWidth = 1.5,
  className,
  'aria-label': ariaLabel,
}: SparklineProps) {
  const pad = strokeWidth + 0.5

  if (!data || data.length < 2) {
    // Flat baseline placeholder keeps row height stable when data is missing.
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={className}
        role="img"
        aria-label={ariaLabel ?? 'no data'}
      >
        <line
          x1={pad}
          y1={height / 2}
          x2={width - pad}
          y2={height / 2}
          stroke="var(--hairline-2)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
      </svg>
    )
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const innerW = width - pad * 2
  const innerH = height - pad * 2

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * innerW
    const y = pad + (1 - (v - min) / span) * innerH
    return [x, y] as const
  })

  const resolvedTone: Tone =
    tone === 'auto'
      ? data[data.length - 1] >= data[0]
        ? 'up'
        : 'down'
      : tone
  const color = TONE_COLOR_VAR[resolvedTone]

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ')

  const areaPath =
    `${linePath} L${points[points.length - 1][0].toFixed(2)} ${(height - pad).toFixed(2)}` +
    ` L${points[0][0].toFixed(2)} ${(height - pad).toFixed(2)} Z`

  const gid = `spark-${resolvedTone}-${width}x${height}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={ariaLabel ?? `trend ${resolvedTone}`}
      preserveAspectRatio="none"
    >
      {area && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gid})`} />
        </>
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default Sparkline
