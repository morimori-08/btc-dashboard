'use client'

// ============================================================
// Legacy inline helpers — extracted VERBATIM from the former page.tsx monolith.
// These keep the not-yet-rebuilt tabs (everything except Overview) rendering
// identically. Do not "improve" them; they are a faithful copy.
// ============================================================

import { useState, useEffect } from 'react'
import { fmtN, buildSignals, buildNarrative, CAT_META, type Signal } from '../../lib/dashboard'

// ------------------------------------------------------------
// コンポーネント
// ------------------------------------------------------------

export function GlassCard({ children, style, className }: {
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}) {
  return (
    <div className={`glass-card ${className || ''}`} style={{ padding: '16px 18px', position: 'relative', overflow: 'hidden', ...style }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 48, height: 48,
        background: 'linear-gradient(225deg,rgba(247,147,26,0.08) 0%,transparent 60%)',
        borderRadius: '0 16px 0 0', pointerEvents: 'none',
      }} />
      {children}
    </div>
  )
}

export type MetricColor = 'default' | 'btc' | 'green' | 'red' | 'cyan'

export function MetricCard({ label, value, sub, color, accent }: {
  label: string
  value: string
  sub?: string
  color?: MetricColor
  accent?: boolean
}) {
  const cls =
    color === 'btc'   ? 'text-btc'   :
    color === 'green' ? 'text-green' :
    color === 'red'   ? 'text-red'   :
    color === 'cyan'  ? 'text-cyan'  : ''
  return (
    <GlassCard style={accent ? { borderColor: 'rgba(247,147,26,0.35)' } : {}}>
      <div className="metric-label">{label}</div>
      <div
        className={`metric-value text-mono ${cls}`}
        style={{ color: !color || color === 'default' ? 'var(--text)' : undefined }}
      >
        {value}
      </div>
      {sub && <div className="metric-sub">{sub}</div>}
    </GlassCard>
  )
}

export function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 3, height: 18,
          background: 'var(--btc)', borderRadius: 2,
          boxShadow: '0 0 8px rgba(247,147,26,0.6)',
        }} />
        <h2 style={{ fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text)' }}>
          {title}
        </h2>
        {sub && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{sub}</span>}
      </div>
    </div>
  )
}

export function Badge({ label, type = 'muted' }: { label: string; type?: 'green' | 'red' | 'btc' | 'cyan' | 'muted' }) {
  return <span className={`badge badge-${type}`}>{label}</span>
}

export function AnalysisPanel({ d }: { d: any }) {
  const sigs   = buildSignals(d)
  const bullW  = sigs.filter(s => s.verdict === 'bull').reduce((a, s) => a + s.weight, 0)
  const bearW  = sigs.filter(s => s.verdict === 'bear').reduce((a, s) => a + s.weight, 0)
  const total  = bullW + bearW || 1
  const bullPct = Math.round(bullW / total * 100)
  const bearPct = 100 - bullPct

  let bias: 'BULL' | 'BEAR' | 'NEUTRAL' = 'NEUTRAL'
  let biasColor = 'var(--btc)'
  if (bullW >= bearW + 4)      { bias = 'BULL'; biasColor = 'var(--green)' }
  else if (bearW >= bullW + 4) { bias = 'BEAR'; biasColor = 'var(--red)' }

  const narrative = buildNarrative(sigs, bias, bullPct)

  // カテゴリ順に表示
  const catOrder: Signal['cat'][] = ['tech', 'position', 'flow', 'liq', 'macro', 'momentum']

  return (
    <GlassCard style={{ padding: '20px 24px', marginBottom: 16 }}>

      {/* ── ヘッダー ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 2 }}>AI MARKET ANALYSIS</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: biasColor, textShadow: `0 0 28px ${biasColor}55`, letterSpacing: '0.06em', lineHeight: 1 }}>
            {bias}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ display: 'flex', height: 12, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ width: `${bullPct}%`, background: 'linear-gradient(90deg,#00FF88cc,#00FF8844)', transition: 'width 0.6s' }} />
            <div style={{ width: `${bearPct}%`, background: 'linear-gradient(90deg,#FF336644,#FF3366cc)', transition: 'width 0.6s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: '0.68rem', fontFamily: 'var(--mono)' }}>
            <span style={{ color: 'var(--green)' }}>▲ BULL {bullPct}%</span>
            <span style={{ color: 'var(--text-muted)' }}>{sigs.length} signals</span>
            <span style={{ color: 'var(--red)' }}>BEAR {bearPct}% ▼</span>
          </div>
        </div>
      </div>

      {/* ── ナラティブ ── */}
      <div style={{ padding: '11px 16px', background: `${biasColor}0d`, borderRadius: 10, borderLeft: `3px solid ${biasColor}88`, marginBottom: 16, fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.75 }}>
        {narrative}
      </div>

      {/* ── カテゴリ別シグナル ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {catOrder.map(cat => {
          const catSigs = sigs.filter(s => s.cat === cat)
          if (!catSigs.length) return null
          const meta = CAT_META[cat]
          return (
            <div key={cat}>
              {/* カテゴリヘッダー */}
              <div style={{ fontSize: '0.63rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--btc)' }}>{meta.icon}</span>
                {meta.label.toUpperCase()}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 8 }}>
                {catSigs.sort((a, b) => b.weight - a.weight).map((s, i) => {
                  const isB = s.verdict === 'bull', isR = s.verdict === 'bear'
                  const bg  = isB ? 'rgba(0,255,136,0.05)' : isR ? 'rgba(255,51,102,0.05)' : 'rgba(255,255,255,0.025)'
                  const bd  = isB ? 'rgba(0,255,136,0.18)' : isR ? 'rgba(255,51,102,0.18)' : 'rgba(255,255,255,0.07)'
                  const col = isB ? 'var(--green)' : isR ? 'var(--red)' : 'var(--text-muted)'
                  const icon = isB ? '▲' : isR ? '▼' : '●'
                  // 重み表示（●の数）
                  const dots = '●'.repeat(s.weight) + '○'.repeat(3 - s.weight)
                  return (
                    <div key={i} style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 9, padding: '9px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 8 }}>
                        <div>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{s.label}</span>
                          <span style={{ fontSize: '0.58rem', color: col, marginLeft: 6, opacity: 0.7 }}>{dots}</span>
                        </div>
                        <span style={{ fontSize: '0.78rem', fontFamily: 'var(--mono)', fontWeight: 700, color: col, whiteSpace: 'nowrap' }}>
                          {icon} {s.value}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-dim)', lineHeight: 1.55 }}>{s.reason}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}

// ---- candle chart helpers ----
export type Candle = { t: number; o: number; h: number; l: number; c: number }

function calcSMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) =>
    i < period - 1 ? null : closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
  )
}

// DISPLAY_COUNT: 表示する足数（SMA200ウォームアップ後の分）
export const DISPLAY_COUNT: Record<string, number> = { '1h': 120, '4h': 100, '1d': 150, '1w': 80 }

export function CandleChart({ candles, tf }: { candles: Candle[]; tf: string }) {
  if (!candles.length) return <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>データ取得中...</div>

  // SMAはfetch済みの全足で計算（ウォームアップ込み）、表示は最後のdisplayCount本のみ
  const allCloses = candles.map(c => c.c)
  const allSma20  = calcSMA(allCloses, 20)
  const allSma75  = calcSMA(allCloses, 75)
  const allSma200 = calcSMA(allCloses, 200)

  const disp = DISPLAY_COUNT[tf] ?? 120
  const start = Math.max(0, candles.length - disp)
  const vis     = candles.slice(start)
  const vSma20  = allSma20.slice(start)
  const vSma75  = allSma75.slice(start)
  const vSma200 = allSma200.slice(start)

  const W = 900, H = 320, PAD_L = 72, PAD_R = 16, PAD_T = 16, PAD_B = 32
  const cw = W - PAD_L - PAD_R
  const ch = H - PAD_T - PAD_B
  const n  = vis.length

  const highs = vis.map(c => c.h)
  const lows  = vis.map(c => c.l)
  // price range includes SMA lines so axis stays tight
  const smaVals = [...vSma20, ...vSma75, ...vSma200].filter(v => v != null) as number[]
  const priceHi = Math.max(...highs, ...smaVals) * 1.001
  const priceLo = Math.min(...lows,  ...smaVals) * 0.999
  const priceRange = priceHi - priceLo

  const px = (i: number) => PAD_L + (i + 0.5) * (cw / n)
  const py = (v: number) => PAD_T + ch - (v - priceLo) / priceRange * ch
  const barW = Math.max(1, cw / n * 0.7)

  const nLabels = 5
  const priceLabels = Array.from({ length: nLabels }, (_, i) => priceLo + (priceRange * i) / (nLabels - 1))

  // Build SVG path for SMA line (guaranteed continuous since start is always non-null)
  const linePoints = (sma: (number | null)[]) => {
    let d = ''
    for (let i = 0; i < sma.length; i++) {
      const v = sma[i]
      if (v == null) continue
      const x = px(i).toFixed(1), y = py(v).toFixed(1)
      d += (d === '' || sma[i - 1] == null) ? `M${x} ${y}` : `L${x} ${y}`
    }
    return d
  }

  return (
    <div className="chart-svg-wrap">
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* grid lines */}
      {priceLabels.map((p, i) => {
        const y = py(p)
        return (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={PAD_L - 6} y={y + 4} textAnchor="end" fill="#666" fontSize="10" fontFamily="monospace">
              {p >= 1000 ? `${(p / 1000).toFixed(1)}K` : p.toFixed(0)}
            </text>
          </g>
        )
      })}
      {/* candles */}
      {vis.map((c, i) => {
        const isUp = c.c >= c.o
        const color = isUp ? '#00FF88' : '#FF3366'
        const x = px(i)
        const yH = py(c.h), yL = py(c.l)
        const yO = py(c.o), yC = py(c.c)
        const bodyTop = Math.min(yO, yC)
        const bodyH   = Math.max(1, Math.abs(yC - yO))
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={yH} y2={yL} stroke={color} strokeWidth="1" opacity="0.6" />
            <rect x={x - barW / 2} y={bodyTop} width={barW} height={bodyH} fill={color} opacity="0.85" rx="0.5" />
          </g>
        )
      })}
      {/* SMA lines — drawn on top of candles */}
      <path d={linePoints(vSma200)} stroke="#FF3366" strokeWidth="1.8" fill="none" opacity="0.95" />
      <path d={linePoints(vSma75)}  stroke="#F7931A" strokeWidth="1.8" fill="none" opacity="0.95" />
      <path d={linePoints(vSma20)}  stroke="#00D4FF" strokeWidth="1.8" fill="none" opacity="0.95" />
      {/* legend */}
      {[['SMA20','#00D4FF'],['SMA75','#F7931A'],['SMA200','#FF3366']].map(([label, color], i) => (
        <g key={label} transform={`translate(${PAD_L + i * 80},${H - 8})`}>
          <line x1="0" x2="16" y1="0" y2="0" stroke={color} strokeWidth="2" />
          <text x="20" y="4" fill={color} fontSize="10" fontFamily="monospace">{label}</text>
        </g>
      ))}
    </svg>
    </div>
  )
}

export const EXCHANGE_COLORS: Record<string, string> = {
  okx:     '#00D4FF',
  binance: '#F7931A',
  bybit:   '#9B59B6',
  bitmex:  '#FF6B35',
}

export function LiqMapChart({ lh, price }: { lh: any; price: number }) {
  const [candles, setCandles] = useState<Candle[]>([])
  const [loading, setLoading] = useState(true)
  const [tf, setTf] = useState<'1h' | '4h' | '1d'>('1h')

  const tfCfg: Record<string, { interval: string; fetch: number; disp: number }> = {
    '1h': { interval: '1h', fetch: 320, disp: 100 },
    '4h': { interval: '4h', fetch: 300, disp: 80  },
    '1d': { interval: '1d', fetch: 350, disp: 120 },
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const { interval, fetch: limit } = tfCfg[tf]
    fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`)
      .then(r => r.json())
      .then((rows: any[]) => {
        if (cancelled) return
        setCandles(rows.map((r: any) => ({
          t: r[0], o: parseFloat(r[1]), h: parseFloat(r[2]), l: parseFloat(r[3]), c: parseFloat(r[4]),
        })))
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tf])

  const levels  = (lh.liq_levels || []) as any[]
  const events  = (lh.all_exchange_liq || lh.okx_recent_liq || []) as any[]
  const maxBtc  = Math.max(...levels.map((l: any) => Math.max(l.long_liq_btc, l.short_liq_btc)), 1)

  // ---- SVG layout ----
  const W = 920, H = 420, PL = 68, PR = 100, PT = 12, PB = 24
  const cw = W - PL - PR, ch = H - PT - PB

  const { disp } = tfCfg[tf]
  const start   = Math.max(0, candles.length - disp)
  const vis     = candles.slice(start)
  const n       = vis.length

  // price range: candles + all liq levels (so lines are always visible)
  const levelPrices = levels.map((l: any) => l.price_level)
  const allH = vis.map(c => c.h).concat(levelPrices)
  const allL = vis.map(c => c.l).concat(levelPrices)
  const priceHi = allH.length ? Math.max(...allH) * 1.002 : price * 1.2
  const priceLo = allL.length ? Math.min(...allL) * 0.998 : price * 0.8
  const pRange  = priceHi - priceLo || 1

  const px  = (i: number) => PL + (i + 0.5) * (cw / Math.max(n, 1))
  const py  = (v: number) => PT + ch - (v - priceLo) / pRange * ch
  const bw  = Math.max(1, cw / Math.max(n, 1) * 0.7)

  // map event timestamp → x position
  const evX = (ev: any): number => {
    if (!ev.time_ms || !vis.length) return PL + cw - 8
    for (let i = 0; i < vis.length - 1; i++) {
      if (vis[i].t <= ev.time_ms && ev.time_ms < vis[i + 1].t) return px(i)
    }
    return ev.time_ms >= vis[vis.length - 1].t ? PL + cw - 8 : PL + 8
  }

  const gridPrices = Array.from({ length: 6 }, (_, i) => priceLo + (pRange * i) / 5)

  const tfLabels: Record<string, string> = { '1h': '1時間', '4h': '4時間', '1d': '日足' }

  return (
    <div>
      {/* timeframe selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {(['1h', '4h', '1d'] as const).map(t => (
          <button key={t} onClick={() => setTf(t)} style={{
            padding: '5px 14px', borderRadius: 8, fontSize: '0.8rem', fontFamily: 'var(--mono)',
            fontWeight: tf === t ? 700 : 400,
            background: tf === t ? 'var(--btc)' : 'rgba(255,255,255,0.06)',
            color: tf === t ? '#000' : 'var(--text-dim)',
            border: tf === t ? 'none' : '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer',
          }}>{tfLabels[t]}</button>
        ))}
        {loading && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>読み込み中...</span>}
      </div>

      <div className="chart-svg-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* background clip region */}
        <defs>
          <clipPath id="chart-area">
            <rect x={PL} y={PT} width={cw} height={ch} />
          </clipPath>
        </defs>

        {/* grid */}
        {gridPrices.map((p, i) => {
          const y = py(p)
          return (
            <g key={i}>
              <line x1={PL} x2={PL + cw} y1={y} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <text x={PL - 5} y={y + 4} textAnchor="end" fill="#555" fontSize="10" fontFamily="monospace">
                ${(p / 1000).toFixed(1)}K
              </text>
            </g>
          )
        })}

        {/* liquidation level lines — drawn behind candles */}
        <g clipPath="url(#chart-area)">
          {levels.map((lv: any) => {
            const isAbove = lv.price_level > price
            const btc     = isAbove ? lv.short_liq_btc : lv.long_liq_btc
            const alpha   = 0.18 + (btc / maxBtc) * 0.55
            const stroke  = isAbove ? '#00FF88' : '#FF3366'
            const sw      = 1 + (btc / maxBtc) * 2.5
            const y       = py(lv.price_level)
            return (
              <line key={lv.price_level}
                x1={PL} x2={PL + cw} y1={y} y2={y}
                stroke={stroke} strokeWidth={sw}
                strokeDasharray="5 4"
                opacity={alpha}
              />
            )
          })}
        </g>

        {/* current price line */}
        <line x1={PL} x2={PL + cw} y1={py(price)} y2={py(price)}
          stroke="#F7931A" strokeWidth="1.5" strokeDasharray="8 4" opacity="0.9" />

        {/* candles */}
        <g clipPath="url(#chart-area)">
          {vis.map((c, i) => {
            const isUp  = c.c >= c.o
            const col   = isUp ? '#00FF88' : '#FF3366'
            const x     = px(i)
            const bodyT = Math.min(py(c.o), py(c.c))
            const bodyH = Math.max(1, Math.abs(py(c.c) - py(c.o)))
            return (
              <g key={i}>
                <line x1={x} x2={x} y1={py(c.h)} y2={py(c.l)} stroke={col} strokeWidth="1" opacity="0.55" />
                <rect x={x - bw / 2} y={bodyT} width={bw} height={bodyH} fill={col} opacity="0.85" rx="0.5" />
              </g>
            )
          })}
        </g>

        {/* liquidation event dots on chart */}
        <g clipPath="url(#chart-area)">
          {events.map((ev: any, i: number) => {
            const evY   = py(ev.price)
            const evXv  = evX(ev)
            const isLng = ev.side === 'long'
            const dc    = isLng ? '#FF3366' : '#00FF88'
            const ec    = EXCHANGE_COLORS[ev.exchange || 'okx'] || '#888'
            return (
              <circle key={i} cx={evXv} cy={evY} r="4.5"
                fill={dc} stroke={ec} strokeWidth="1.5" opacity="0.92" />
            )
          })}
        </g>

        {/* right-side labels for liq levels */}
        {levels.map((lv: any) => {
          const isAbove = lv.price_level > price
          const btc     = isAbove ? lv.short_liq_btc : lv.long_liq_btc
          const alpha   = 0.4 + (btc / maxBtc) * 0.6
          const col     = isAbove ? '#00FF88' : '#FF3366'
          const y       = py(lv.price_level)
          return (
            <g key={lv.price_level}>
              <text x={PL + cw + 5} y={y - 2} fill={col} fontSize="9" fontFamily="monospace" opacity={alpha}>
                ${(lv.price_level / 1000).toFixed(1)}K
              </text>
              <text x={PL + cw + 5} y={y + 9} fill={col} fontSize="8" fontFamily="monospace" opacity={alpha * 0.75}>
                {fmtN(btc)}BTC
              </text>
            </g>
          )
        })}

        {/* NOW label */}
        <text x={PL + cw + 5} y={py(price) + 4} fill="#F7931A" fontSize="9" fontFamily="monospace" fontWeight="bold">
          NOW
        </text>

        {/* legend */}
        <g transform={`translate(${PL}, ${H - 6})`}>
          {[
            ['─ ロング清算水準', '#FF3366'],
            ['─ ショート清算水準', '#00FF88'],
            ['● OKX', '#00D4FF'],
            ['● Binance', '#F7931A'],
            ['● Bybit', '#9B59B6'],
            ['● BitMEX', '#FF6B35'],
          ].map(([label, color], i) => (
            <text key={label} x={i * 120} y={0} fill={color} fontSize="9" fontFamily="monospace" opacity="0.8">
              {label}
            </text>
          ))}
        </g>
      </svg>
      </div>
    </div>
  )
}
