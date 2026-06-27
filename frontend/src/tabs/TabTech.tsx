'use client'

// ============================================================
// TabTech: REBUILT with the ui/ design-system primitives
// (Panel / DataTable / Badge). Data parity with the former inline
// TabTech: the composite signal + score + per-timeframe trend_score chips,
// the BTC/USDT CandleChart (kept: shared legacy SVG chart) with its 1H/4H/
// 1D/1W selector, and the SMA/RSI table (price, SMA20/75/200 with the same
// above/below colors + check/cross marks, RSI14 with the same over/oversold
// colors, and the trend Badge). Only the surrounding structure/visuals changed.
// ============================================================

import { useState, useEffect } from 'react'
import { fmtN } from '../lib/dashboard'
import { Panel, DataTable, Badge, type Column } from '@/components/ui'
import { cn } from '@/components/ui'
import { CandleChart, DISPLAY_COUNT, type Candle } from '../components/legacy'

type TechRow = { tf: string }

export function TabTech({ d }: { d: any }) {
  const tech = d.technical || {}
  const TFs: string[] = ['1h', '4h', '1d', '1w']
  const TFLabels: Record<string, string> = { '1h': '1時間', '4h': '4時間', '1d': '日足', '1w': '週足' }
  const sig      = tech.signal || 'NEUTRAL'
  const score    = tech.composite_score || 0
  const sigColor = sig === 'BULL' ? 'var(--green)' : sig === 'BEAR' ? 'var(--red)' : 'var(--btc)'

  const [chartTF, setChartTF] = useState<string>('1h')
  const [candles, setCandles] = useState<Candle[]>([])
  const [chartLoading, setChartLoading] = useState(false)

  const intervalMap: Record<string, string> = { '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1w' }
  // SMA200ウォームアップ(200本) + 表示分(DISPLAY_COUNT) を合算してfetch
  const limitMap: Record<string, number> = {
    '1h': 200 + (DISPLAY_COUNT['1h'] ?? 120),   // 320
    '4h': 200 + (DISPLAY_COUNT['4h'] ?? 100),   // 300
    '1d': 200 + (DISPLAY_COUNT['1d'] ?? 150),   // 350
    '1w': 200 + (DISPLAY_COUNT['1w'] ?? 80),    // 280
  }

  useEffect(() => {
    let cancelled = false
    setChartLoading(true)
    const interval = intervalMap[chartTF]
    const limit    = limitMap[chartTF]
    fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`)
      .then(r => r.json())
      .then((rows: any[]) => {
        if (cancelled) return
        setCandles(rows.map((r: any) => ({
          t: r[0], o: parseFloat(r[1]), h: parseFloat(r[2]), l: parseFloat(r[3]), c: parseFloat(r[4]),
        })))
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setChartLoading(false) })
    return () => { cancelled = true }
  }, [chartTF])

  // ── SMA/RSI table rows + columns ──
  const rows: TechRow[] = TFs.map((tf) => ({ tf }))

  const smaCol = (s: 'sma20' | 'sma75' | 'sma200', header: string): Column<TechRow> => ({
    key: s,
    header,
    align: 'right',
    cell: (r) => {
      const t = tech[r.tf] || {}
      const vs   = t[`vs_${s}`]
      const smaV = t[s]
      const col  = vs === 'above' ? 'var(--green)' : vs === 'below' ? 'var(--red)' : 'var(--text-dim)'
      return (
        <span style={{ color: col }}>
          {smaV ? `$${fmtN(smaV)}` : '—'}
          {vs === 'above' ? ' ✓' : vs === 'below' ? ' ✗' : ''}
        </span>
      )
    },
  })

  const cols: Column<TechRow>[] = [
    {
      key: 'tf',
      header: '時間足',
      align: 'left',
      cell: (r) => <span className="font-sans font-bold text-accent">{TFLabels[r.tf]}</span>,
    },
    {
      key: 'price',
      header: '現在価格',
      align: 'right',
      cell: (r) => {
        const t = tech[r.tf] || {}
        return <span className="font-bold text-ink">{t.price ? `$${fmtN(t.price)}` : '—'}</span>
      },
    },
    smaCol('sma20', 'SMA 20'),
    smaCol('sma75', 'SMA 75'),
    smaCol('sma200', 'SMA 200'),
    {
      key: 'rsi',
      header: 'RSI 14',
      align: 'right',
      cell: (r) => {
        const t = tech[r.tf] || {}
        const col = t.rsi14 > 70 ? 'var(--red)' : t.rsi14 < 30 ? 'var(--green)' : 'var(--text)'
        return <span style={{ color: col }}>{t.rsi14 ? t.rsi14.toFixed(1) : '—'}</span>
      },
    },
    {
      key: 'trend',
      header: 'トレンド',
      align: 'right',
      cell: (r) => {
        const t = tech[r.tf] || {}
        if (t.trend_score == null) return '—'
        return (
          <Badge tone={t.trend_score > 0 ? 'bull' : t.trend_score < 0 ? 'bear' : 'muted'} size="sm">
            {t.trend_score > 0 ? '▲' : '▼'} {Math.abs(t.trend_score)}
          </Badge>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* 総合 */}
      <Panel>
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-2xs font-medium uppercase tracking-label text-ink-muted">総合シグナル</span>
            <span className="text-[1.5rem] font-extrabold leading-none" style={{ color: sigColor }}>
              {sig}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-2xs font-medium uppercase tracking-label text-ink-muted">スコア</span>
            <span className="tabular font-mono text-[1.2rem] font-bold text-ink">
              {score > 0 ? '+' : ''}{score.toFixed(1)}/3.0
            </span>
          </div>
          <div className="flex flex-1 flex-wrap justify-end gap-2">
            {TFs.map(tf => {
              const t  = tech[tf] || {}
              const ts = t.trend_score || 0
              return (
                <div key={tf} className="min-w-[72px] text-center">
                  <div className="mb-1 text-2xs text-ink-muted">{TFLabels[tf]}</div>
                  <Badge tone={ts > 0 ? 'bull' : ts < 0 ? 'bear' : 'neutral'} className="justify-center">
                    {ts > 0 ? '+' : ''}{ts}
                  </Badge>
                </div>
              )
            })}
          </div>
        </div>
      </Panel>

      {/* ローソク足チャート */}
      <Panel title="BTC/USDT チャート" accent action={<Badge tone="muted" size="sm">SMA20 (水) · SMA75 (橙) · SMA200 (赤)</Badge>}>
        <div className="mb-3 flex gap-2">
          {TFs.map(tf => (
            <button key={tf} onClick={() => setChartTF(tf)} style={{
              padding: '5px 14px', borderRadius: 8, fontSize: '0.8rem', fontFamily: 'var(--mono)',
              fontWeight: chartTF === tf ? 700 : 400,
              background: chartTF === tf ? 'var(--btc)' : 'rgba(255,255,255,0.06)',
              color: chartTF === tf ? '#000' : 'var(--text-dim)',
              border: chartTF === tf ? 'none' : '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer', transition: 'all 0.2s',
            }}>{TFLabels[tf]}</button>
          ))}
          {chartLoading && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>読み込み中...</span>}
        </div>
        <CandleChart candles={candles} tf={chartTF} />
      </Panel>

      {/* SMAテーブル */}
      <Panel title="SMA / RSI" accent action={<Badge tone="muted" size="sm">1H · 4H · 日足 · 週足</Badge>}>
        <DataTable
          columns={cols}
          rows={rows}
          rowKey={(r) => r.tf}
          minWidth={640}
          caption="時間足別 SMA / RSI / トレンド"
        />
      </Panel>
    </div>
  )
}

export default TabTech
