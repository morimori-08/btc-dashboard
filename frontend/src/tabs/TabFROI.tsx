'use client'

// ============================================================
// TabFROI — REBUILT with the ui/ design-system primitives.
// Data parity: same Funding Rate heatmap (15 coins x 12 exchanges + Avg +
// Spread) and the same Open Interest table (9 coins x 5 exchanges + total).
// Funding cells keep their sign/magnitude tint via DataTable's HeatCell
// columns; the displayed numbers/strings are identical to the old table.
// ============================================================

import {
  Panel,
  DataTable,
  Badge,
  type Column,
} from '@/components/ui'
import { TOP15, OI_EXCHANGES, fmtN } from '../lib/dashboard'

const FR_EXCHANGES = ['binance','bybit','okx','hyperliquid','gate','bitget','mexc','htx','dydx','bitmex','bingx','woox']
const OI_COINS = ['BTC','ETH','SOL','XRP','BNB','DOGE','ADA','LINK','AVAX']

type FrRow = { coin: string; cells: Record<string, number | undefined>; avg: number | null; spread: number | null }
type OiRow = { coin: string; cells: Record<string, number | undefined>; total: number | null }

export function TabFROI({ d }: { d: any }) {
  const fr  = d.funding_rates || {}
  const agg = d.fr_aggregate || {}
  const oi  = d.open_interest || {}

  // ── Funding Rate rows (preserve order = TOP15) ──
  const frRows: FrRow[] = TOP15.map((coin) => {
    const coinFR = fr[coin] || {}
    const a = agg[coin] || {}
    const cells: Record<string, number | undefined> = {}
    for (const ex of FR_EXCHANGES) cells[ex] = coinFR[ex]
    return { coin, cells, avg: a.avg ?? null, spread: a.spread ?? null }
  })

  const frCols: Column<FrRow>[] = [
    {
      key: 'coin',
      header: '銘柄',
      align: 'left',
      cell: (r) => <span className="font-sans font-bold text-ink">{r.coin}</span>,
    },
    ...FR_EXCHANGES.map((ex): Column<FrRow> => ({
      key: ex,
      header: ex.slice(0, 7),
      align: 'right',
      heat: (r) => r.cells[ex],
      heatScale: 0.00008, // (v*100) bucket "strong" at 0.005% → raw 0.00005; full tint near strong band
      cell: (r) => {
        const v = r.cells[ex]
        return v != null
          ? (v * 100).toFixed(4)
          : <span className="text-ink-muted opacity-40">—</span>
      },
    })),
    {
      key: 'avg',
      header: 'Avg',
      align: 'right',
      heat: (r) => r.avg,
      heatScale: 0.00008,
      cell: (r) => (
        <span className="font-bold">{r.avg != null ? (r.avg * 100).toFixed(4) : '—'}</span>
      ),
    },
    {
      key: 'spread',
      header: 'Spread',
      align: 'right',
      cell: (r) => <span className="text-ink-dim">{r.spread != null ? (r.spread * 100).toFixed(4) : '—'}</span>,
    },
  ]

  // ── Open Interest rows ──
  const oiRows: OiRow[] = OI_COINS.map((coin) => {
    const coinOI = oi[coin] || {}
    const tot = d.oi_total?.[coin] || {}
    const cells: Record<string, number | undefined> = {}
    for (const ex of OI_EXCHANGES) cells[ex] = coinOI[ex]?.oi_coin
    return { coin, cells, total: tot.total_coin ?? null }
  })

  const oiCols: Column<OiRow>[] = [
    {
      key: 'coin',
      header: '銘柄',
      align: 'left',
      cell: (r) => <span className="font-sans font-bold text-ink">{r.coin}</span>,
    },
    ...OI_EXCHANGES.map((ex): Column<OiRow> => ({
      key: ex,
      header: ex,
      align: 'right',
      cell: (r) => {
        const v = r.cells[ex]
        return v != null ? fmtN(v) : <span className="opacity-30">—</span>
      },
    })),
    {
      key: 'total',
      header: '合計 (coin)',
      align: 'right',
      cell: (r) => <span className="font-bold text-accent">{r.total != null ? fmtN(r.total) : '—'}</span>,
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <Panel
        title="Funding Rate ヒートマップ"
        accent
        action={<Badge tone="muted" size="sm">15銘柄 × 12取引所</Badge>}
      >
        <DataTable
          columns={frCols}
          rows={frRows}
          rowKey={(r) => r.coin}
          minWidth={800}
          caption="15銘柄 × 12取引所の資金調達率ヒートマップ"
        />
      </Panel>

      <Panel
        title="Open Interest"
        accent
        action={<Badge tone="muted" size="sm">BTC建て · 主要取引所</Badge>}
      >
        <DataTable
          columns={oiCols}
          rows={oiRows}
          rowKey={(r) => r.coin}
          minWidth={600}
          caption="主要取引所の建玉 (coin建て)"
        />
      </Panel>
    </div>
  )
}

export default TabFROI
