'use client'

// ============================================================
// TabChanges — REBUILT with the ui/ design-system primitives.
// Data parity: same 10 metrics, same now/24h/7d/30d values + color
// directions (green>0 / red<0 / dim=0), and the same 前日比 horizontal
// magnitude bars (absMax=20, centered, green right / red left). The bars
// are single scalar values (not a series) so they stay as inline bars.
// ============================================================

import { type ReactNode } from 'react'
import { Panel, DataTable, type Column } from '@/components/ui'
import { fmt, fmtP, fmtM, fmtB, fmtN } from '../lib/dashboard'

type Spec = { key: string; label: string; fmtFn: (v: number) => string }
type Row = Spec & { now: number | null; chg_24h: number | null; chg_7d: number | null; chg_30d: number | null }

const SPECS: Spec[] = [
  { key: 'btc_price',         label: 'BTC価格',         fmtFn: (v) => `$${fmtN(v)}` },
  { key: 'btc_dominance',     label: 'BTCドミナンス',   fmtFn: (v) => `${fmt(v)}%` },
  { key: 'dvol',              label: 'DVOL',            fmtFn: (v) => fmt(v, 1) },
  { key: 'fr_avg_btc',        label: 'BTC FR平均',      fmtFn: (v) => fmtP(v) },
  { key: 'etf_daily',         label: 'ETF Flow (日次)', fmtFn: (v) => fmtM(v) },
  { key: 'exchange_flow_net', label: '取引所Flow net',  fmtFn: (v) => fmtM(v) },
  { key: 'stablecoin_total',  label: 'SC供給合計',      fmtFn: (v) => fmtB(v) },
  { key: 'mempool_count',     label: 'Mempool TX',      fmtFn: (v) => fmtN(v) },
  { key: 'oi_total_btc',      label: 'BTC OI合計',      fmtFn: (v) => `${fmtN(v)} BTC` },
  { key: 'coinbase_premium',  label: 'CB Premium',      fmtFn: (v) => fmtP(v, 3) },
]

// Same color direction as the old chgColor (green>0 / red<0 / dim / muted=null).
const chgCls = (v: number | null | undefined) =>
  v == null ? 'text-ink-muted' : v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-ink-dim'
const chgFmt = (v: number | null | undefined) =>
  v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`

export function TabChanges({ d }: { d: any }) {
  const ch = d.changes || {}

  const rows: Row[] = SPECS.map((s) => {
    const c = ch[s.key] || {}
    return {
      ...s,
      now: c.now ?? null,
      chg_24h: c.chg_24h ?? null,
      chg_7d: c.chg_7d ?? null,
      chg_30d: c.chg_30d ?? null,
    }
  })

  const tint = (v: number | null | undefined, node: ReactNode) => (
    <span className={`${chgCls(v)} font-semibold`}>{node}</span>
  )

  const cols: Column<Row>[] = [
    {
      key: 'label',
      header: 'データ',
      align: 'left',
      cell: (r) => <span className="font-sans font-medium text-ink">{r.label}</span>,
    },
    {
      key: 'now',
      header: '現在値',
      align: 'right',
      cell: (r) => <span className="text-ink">{r.now != null ? r.fmtFn(r.now) : '—'}</span>,
    },
    { key: 'chg_24h', header: '前日比', align: 'right', cell: (r) => tint(r.chg_24h, chgFmt(r.chg_24h)) },
    { key: 'chg_7d',  header: '前週比', align: 'right', cell: (r) => tint(r.chg_7d, chgFmt(r.chg_7d)) },
    { key: 'chg_30d', header: '前月比', align: 'right', cell: (r) => tint(r.chg_30d, chgFmt(r.chg_30d)) },
  ]

  return (
    <div className="flex flex-col gap-3">
      <Panel
        title="変化率"
        accent
        action={<span className="text-2xs text-ink-muted">前日 / 前週 / 前月</span>}
      >
        <DataTable columns={cols} rows={rows} rowKey={(r) => r.key} caption="主要指標の変化率" />
      </Panel>

      <Panel title="前日比 横棒チャート" accent action={<span className="text-2xs text-ink-muted">正値=緑 / 負値=赤</span>}>
        {rows.map(({ key, label, chg_24h: v }) => {
          if (v == null) return null
          const absMax = 20
          const w = Math.min((Math.abs(v) / absMax) * 100, 100)
          const isPos = v >= 0
          const color = isPos ? 'var(--up)' : 'var(--down)'
          const colorRGB = isPos ? '45,190,132' : '240,93,114'
          return (
            <div key={key} className="mb-2 flex items-center gap-2.5">
              <div className="min-w-[120px] text-[0.72rem] text-ink-dim">{label}</div>
              <div className="relative flex h-5 flex-1 items-center justify-center overflow-hidden rounded bg-[rgba(255,255,255,0.03)]">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[rgba(255,255,255,0.1)]" />
                <div
                  className="absolute h-full"
                  style={{
                    ...(isPos ? { left: '50%' } : { right: '50%' }),
                    width: `${w / 2}%`,
                    background: `linear-gradient(${isPos ? '90deg' : '270deg'},${color}66,${color}22)`,
                    boxShadow: `inset 0 0 8px rgba(${colorRGB},0.2)`,
                    borderRadius: isPos ? '0 4px 4px 0' : '4px 0 0 4px',
                  }}
                />
              </div>
              <div
                className="min-w-[60px] text-right font-mono text-[0.75rem] font-semibold tabular"
                style={{ color }}
              >
                {v > 0 ? '+' : ''}{v.toFixed(2)}%
              </div>
            </div>
          )
        })}
      </Panel>
    </div>
  )
}

export default TabChanges
