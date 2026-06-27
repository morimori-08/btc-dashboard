'use client'

// ============================================================
// TabLiqMap: REBUILT with the ui/ design-system primitives
// (Panel / Metric / DataTable / Badge). Data parity with the former inline
// TabLiqMap: the 4 key-level metrics (major/next long-liq below, next/major
// short-liq above, with the same red/green color direction + "現在から ±$NK"
// subs), the LiqMapChart (kept: shared legacy SVG chart) with its built-in
// timeframe selector, and the 直近清算イベント table (time JST, exchange-
// colored name, side Badge, liq price, size BTC, est USD). Only the
// surrounding structure/visuals changed.
// ============================================================

import { type ReactNode } from 'react'
import { Panel, Metric, DataTable, Badge, type Column } from '@/components/ui'
import { LiqMapChart, EXCHANGE_COLORS } from '../components/legacy'

export function TabLiqMap({ d }: { d: any }) {
  const lh    = d.liq_heatmap || {}
  const kl    = lh.key_levels || {}
  const price = d.btc_price || 80000

  // tint helper (same pattern as TabOverview): preserve the exact value string
  // with the same color intent.
  const tint = (cls: string, node: ReactNode) =>
    cls ? <span className={cls}>{node}</span> : node

  const allEvts: any[] = lh.all_exchange_liq || []
  const sortedEvts = [...allEvts].sort((a, b) => (b.time_ms || 0) - (a.time_ms || 0)).slice(0, 20)

  type EvtRow = any
  const evtCols: Column<EvtRow>[] = [
    {
      key: 'time',
      header: '時刻 (JST)',
      align: 'left',
      cell: (ev) => {
        const tsMs = ev.time_ms
        let timeStr = '—'
        if (tsMs) {
          const jst = new Date(tsMs + 9 * 3600 * 1000)
          timeStr = `${jst.getMonth()+1}/${jst.getDate()} ${jst.getHours()}:${String(jst.getMinutes()).padStart(2,'0')}`
        }
        return <span className="font-mono text-[0.75rem] text-ink-muted">{timeStr}</span>
      },
    },
    {
      key: 'exchange',
      header: '取引所',
      align: 'right',
      cell: (ev) => (
        <span className="font-bold text-[0.8rem]" style={{ color: EXCHANGE_COLORS[ev.exchange || 'okx'] || '#888' }}>
          {(ev.exchange || 'OKX').toUpperCase()}
        </span>
      ),
    },
    {
      key: 'side',
      header: 'サイド',
      align: 'right',
      cell: (ev) => {
        const isLong = ev.side === 'long'
        return <Badge tone={isLong ? 'bear' : 'bull'} size="sm">{isLong ? 'ロング清算' : 'ショート清算'}</Badge>
      },
    },
    {
      key: 'price',
      header: '清算価格',
      align: 'right',
      cell: (ev) => <span className="font-mono text-accent">${ev.price?.toLocaleString()}</span>,
    },
    {
      key: 'size',
      header: 'サイズ (BTC)',
      align: 'right',
      cell: (ev) => <span className="font-mono font-semibold">{ev.size_btc?.toFixed(4)}</span>,
    },
    {
      key: 'usd',
      header: '推定USD',
      align: 'right',
      cell: (ev) => (
        <span className="font-mono text-ink-dim">
          {ev.price && ev.size_btc ? `$${(ev.price * ev.size_btc / 1000).toFixed(1)}K` : '—'}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
          <Metric
            label="ロング最大清算↓"
            value={tint('text-down', kl.major_long_liq_below ? `$${kl.major_long_liq_below.toLocaleString()}` : '—')}
            sub={kl.major_long_liq_below ? `現在から -$${((price - kl.major_long_liq_below) / 1000).toFixed(0)}K` : ''}
          />
          <Metric
            label="ロング次点↓"
            value={tint('text-down', kl.next_long_liq ? `$${kl.next_long_liq.toLocaleString()}` : '—')}
            sub={kl.next_long_liq ? `現在から -$${((price - kl.next_long_liq) / 1000).toFixed(0)}K` : ''}
          />
          <Metric
            label="ショート次点↑"
            value={tint('text-up', kl.next_short_liq ? `$${kl.next_short_liq.toLocaleString()}` : '—')}
            sub={kl.next_short_liq ? `現在から +$${((kl.next_short_liq - price) / 1000).toFixed(0)}K` : ''}
          />
          <Metric
            label="ショート最大清算↑"
            value={tint('text-up', kl.major_short_liq_above ? `$${kl.major_short_liq_above.toLocaleString()}` : '—')}
            sub={kl.major_short_liq_above ? `現在から +$${((kl.major_short_liq_above - price) / 1000).toFixed(0)}K` : ''}
          />
        </div>
      </Panel>

      <Panel title="清算水準マップ" accent action={<Badge tone="muted" size="sm">ローソク足 + 清算水準ライン + 実清算イベント</Badge>}>
        <LiqMapChart lh={lh} price={price} />
      </Panel>

      {sortedEvts.length > 0 && (
        <Panel title="直近清算イベント" accent action={<Badge tone="muted" size="sm">Binance · Bybit · OKX · BitMEX</Badge>}>
          <DataTable
            columns={evtCols}
            rows={sortedEvts}
            rowKey={(_ev, i) => i}
            minWidth={620}
            caption="直近の清算イベント一覧"
          />
        </Panel>
      )}
    </div>
  )
}

export default TabLiqMap
