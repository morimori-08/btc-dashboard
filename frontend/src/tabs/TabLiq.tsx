'use client'

// ============================================================
// TabLiq — REBUILT with the ui/ design-system primitives.
// Data parity: same 4-up liquidation summary, and the same 4 tables
// (取引所別清算 / Taker Buy-Sell / アカウント L/S / 上位トレーダー L/S).
// Every value, conditional (ratio>=1, short>long, net>0), Badge label and
// color direction is preserved; only the layout uses Panel/Metric/DataTable/
// Badge instead of GlassCard/MetricCard/legacy Badge.
// ============================================================

import { type ReactNode } from 'react'
import { Panel, Metric, DataTable, Badge, type Column } from '@/components/ui'
import { fmtN } from '../lib/dashboard'

const COINS = ['BTC','ETH','SOL','XRP','BNB','DOGE','ADA','LINK','AVAX','DOT','LTC','UNI']

const tint = (cls: string, node: ReactNode) => (cls ? <span className={cls}>{node}</span> : node)

type ExRow = { name: string; long: number | undefined; short: number | undefined }
type TakerRow = { coin: string; buy_vol: number; sell_vol: number; ratio: number }
type AcctRow = { coin: string; long: number; short: number; ratio: number }

export function TabLiq({ d }: { d: any }) {
  const liq   = d.liquidations || {}
  const taker = liq.bn_taker_ls || {}
  const acct  = liq.bn_account_ls || {}

  // ── summary (identical math to the old IIFE) ──
  const totalLong  = (liq.okx_long_liq_btc  || 0) + (liq.binance_long_liq_btc  || 0) + (liq.bybit_long_liq_btc  || 0) + (liq.bitmex_long_liq_btc  || 0)
  const totalShort = (liq.okx_short_liq_btc || 0) + (liq.binance_short_liq_btc || 0) + (liq.bybit_short_liq_btc || 0) + (liq.bitmex_short_liq_btc || 0)
  const dir = totalShort > totalLong ? 'SHORT SQUEEZE' : 'LONG SQUEEZE'

  // ── exchange liquidation rows ──
  const exRows: ExRow[] = [
    { name: 'Binance', long: liq.binance_long_liq_btc, short: liq.binance_short_liq_btc },
    { name: 'Bybit',   long: liq.bybit_long_liq_btc,   short: liq.bybit_short_liq_btc   },
    { name: 'OKX',     long: liq.okx_long_liq_btc,     short: liq.okx_short_liq_btc     },
    { name: 'BitMEX',  long: liq.bitmex_long_liq_btc,  short: liq.bitmex_short_liq_btc  },
  ]
  const exCols: Column<ExRow>[] = [
    { key: 'name', header: '取引所', align: 'left', cell: (r) => <span className="font-bold text-accent">{r.name}</span> },
    { key: 'long', header: 'ロング清算 (BTC)', align: 'right', cell: (r) => <span className="text-down font-semibold">{r.long != null ? fmtN(r.long) : '—'}</span> },
    { key: 'short', header: 'ショート清算 (BTC)', align: 'right', cell: (r) => <span className="text-up font-semibold">{r.short != null ? fmtN(r.short) : '—'}</span> },
    {
      key: 'net',
      header: 'Net',
      align: 'right',
      cell: (r) => {
        const net = (r.short || 0) - (r.long || 0)
        return <span className={net > 0 ? 'text-up' : 'text-down'}>{net > 0 ? '+' : ''}{fmtN(net)}</span>
      },
    },
    {
      key: 'dom',
      header: '優勢',
      align: 'left',
      cell: (r) => {
        const isShort = (r.short || 0) > (r.long || 0)
        return <Badge tone={isShort ? 'bull' : 'bear'} size="sm">{isShort ? 'SHORT↑' : 'LONG↓'}</Badge>
      },
    },
  ]

  // ── Taker buy/sell rows ──
  const takerRows: TakerRow[] = COINS.map((coin) => taker[coin] ? { coin, ...taker[coin] } : null).filter(Boolean) as TakerRow[]
  const takerCols: Column<TakerRow>[] = [
    { key: 'coin', header: '銘柄', align: 'left', cell: (r) => <span className="font-sans font-bold text-ink">{r.coin}</span> },
    { key: 'buy', header: 'Buy出来高', align: 'right', cell: (r) => fmtN(r.buy_vol) },
    { key: 'sell', header: 'Sell出来高', align: 'right', cell: (r) => fmtN(r.sell_vol) },
    {
      key: 'ratio',
      header: 'Buy/Sell比',
      align: 'right',
      cell: (r) => {
        const isBuy = (r.ratio || 0) >= 1
        return <span className={`${isBuy ? 'text-up' : 'text-down'} font-bold`}>{r.ratio?.toFixed(4)}</span>
      },
    },
    {
      key: 'dir',
      header: '方向',
      align: 'left',
      cell: (r) => {
        const isBuy = (r.ratio || 0) >= 1
        return <Badge tone={isBuy ? 'bull' : 'bear'} size="sm">{isBuy ? '買超' : '売超'}</Badge>
      },
    },
  ]

  // ── account L/S rows ──
  const acctRows: AcctRow[] = COINS.map((coin) => acct[coin] ? { coin, ...acct[coin] } : null).filter(Boolean) as AcctRow[]
  const acctCols: Column<AcctRow>[] = [
    { key: 'coin', header: '銘柄', align: 'left', cell: (r) => <span className="font-sans font-bold text-ink">{r.coin}</span> },
    { key: 'long', header: 'Long %', align: 'right', cell: (r) => <span className="text-up">{(r.long * 100).toFixed(1)}%</span> },
    { key: 'short', header: 'Short %', align: 'right', cell: (r) => <span className="text-down">{(r.short * 100).toFixed(1)}%</span> },
    {
      key: 'ratio',
      header: 'L/S比',
      align: 'right',
      cell: (r) => <span className={`${r.ratio >= 1 ? 'text-up' : 'text-down'} font-bold`}>{r.ratio?.toFixed(3)}</span>,
    },
  ]

  // ── top trader L/S rows ──
  const topRows: AcctRow[] = COINS.map((coin) => liq.bn_top_ls?.[coin] ? { coin, ...liq.bn_top_ls[coin] } : null).filter(Boolean) as AcctRow[]
  const topCols: Column<AcctRow>[] = [
    { key: 'coin', header: '銘柄', align: 'left', cell: (r) => <span className="font-sans font-bold text-ink">{r.coin}</span> },
    { key: 'long', header: 'Long %', align: 'right', cell: (r) => <span className="text-up">{(r.long * 100).toFixed(1)}%</span> },
    { key: 'short', header: 'Short %', align: 'right', cell: (r) => <span className="text-down">{(r.short * 100).toFixed(1)}%</span> },
    {
      key: 'ratio',
      header: 'L/S比',
      align: 'right',
      cell: (r) => <span className={`${r.ratio >= 1 ? 'text-up' : 'text-down'} font-bold`}>{r.ratio?.toFixed(3)}</span>,
    },
    {
      key: 'pos',
      header: 'ポジション',
      align: 'left',
      cell: (r) => <Badge tone={r.ratio >= 1 ? 'bull' : 'bear'} size="sm">{r.ratio >= 1 ? 'Long優位' : 'Short優位'}</Badge>,
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* 清算サマリー (4-up) */}
      <Panel>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
          <Metric label="合計ロング清算" value={tint('text-down', `${fmtN(totalLong)} BTC`)} />
          <Metric label="合計ショート清算" value={tint('text-up', `${fmtN(totalShort)} BTC`)} />
          <Metric label="BitMEX 清算件数" value={liq.bitmex_liq_count_1h != null ? `${liq.bitmex_liq_count_1h} 件` : '—'} />
          <Metric label="清算方向" value={tint(totalShort > totalLong ? 'text-up' : 'text-down', dir)} />
        </div>
      </Panel>

      <Panel title="主要取引所 清算サマリー" accent action={<span className="text-2xs text-ink-muted">直近リアルタイム</span>}>
        <DataTable columns={exCols} rows={exRows} rowKey={(r) => r.name} caption="取引所別 清算サマリー" />
      </Panel>

      <Panel title="Taker Buy/Sell 比率" accent action={<span className="text-2xs text-ink-muted">Binance · 1H</span>}>
        <DataTable columns={takerCols} rows={takerRows} rowKey={(r) => r.coin} caption="Taker Buy/Sell 比率" />
      </Panel>

      <Panel title="アカウント L/S 比率" accent action={<span className="text-2xs text-ink-muted">Binance</span>}>
        <DataTable columns={acctCols} rows={acctRows} rowKey={(r) => r.coin} caption="アカウント L/S 比率" />
      </Panel>

      <Panel title="上位トレーダー ポジション L/S" accent action={<span className="text-2xs text-ink-muted">Binance · 大口建玉</span>}>
        <DataTable columns={topCols} rows={topRows} rowKey={(r) => r.coin} caption="上位トレーダー ポジション L/S" />
      </Panel>
    </div>
  )
}

export default TabLiq
