'use client'

// ============================================================
// TabOverview — REBUILT with the ui/ design-system primitives
// (Panel / Metric / Sparkline / SignalBanner / DataTable / Badge).
//
// Data parity: every field + value shown here matches the former inline
// TabOverview exactly (BTC dominance, DVOL, FR avg, CB premium, mempool,
// P/C, ETF flow, exchange net flow, the AI analysis narrative, and the
// condensed funding-rate table). Only the structure/visuals changed.
// ============================================================

import { type ReactNode } from 'react'
import {
  Panel,
  Metric,
  SignalBanner,
  DataTable,
  Badge,
  type Column,
  type Signal as BannerSignal,
} from '@/components/ui'
import { fmt, fmtP, fmtM, fmtN } from '../lib/dashboard'
import { AnalysisPanel } from '../components/legacy'

type FrSummaryRow = {
  coin: string
  avg: number | null
  max: number | null
  min: number | null
  spread: number | null
  n_exchanges: number | null
}

export function TabOverview({ d, tech }: { d: any; tech: any }) {
  const vol = d.vol || {}
  const etf = d.etf_flow || {}
  const ef  = d.exchange_flow || {}
  const fr  = d.fr_aggregate || {}
  const mem = d.mempool || {}

  // ── signal banner (same source values as the inline version) ──
  const sigRaw = (tech?.signal as string) || 'NEUTRAL'
  const signal: BannerSignal =
    sigRaw === 'BULL' ? 'BULL' : sigRaw === 'BEAR' ? 'BEAR' : 'NEUTRAL'
  const score = tech?.composite_score || 0

  // ── metric values (identical strings/numbers to the inline version) ──
  // The original tinted the VALUE via a `color` prop. We reproduce that here by
  // wrapping the value node in the matching design-system text token so the
  // exact same string is shown with the same color intent (no invented deltas).
  const tint = (cls: string, node: ReactNode) =>
    cls ? <span className={cls}>{node}</span> : node

  // BTC ドミナンス: color="btc"
  const dominanceVal = d.btc_dominance ? `${fmt(d.btc_dominance)}%` : '—'

  // DVOL: color = VRP>8 ? red : cyan
  const dvolVal = fmt(vol.dvol, 1)
  const dvolSub = `HV ${fmt(vol.realized_vol, 1)}  VRP ${vol.vrp != null ? (vol.vrp > 0 ? '+' : '') + fmt(vol.vrp, 1) : '—'}pt`
  const dvolCls = vol.vrp != null && vol.vrp > 8 ? 'text-down' : 'text-cool'

  // FR 平均: color = avg>0.0003 ? red : avg<-0.0003 ? cyan : default
  const frAvg = fr.BTC?.avg
  const frVal = frAvg != null ? fmtP(frAvg) : '—'
  const frSub = frAvg != null ? (frAvg > 0 ? 'ロング偏重' : 'ショート偏重') : ''
  const frCls = frAvg != null ? (frAvg > 0.0003 ? 'text-down' : frAvg < -0.0003 ? 'text-cool' : '') : ''

  // CB Premium: color = >0 ? green : red
  const cbp = d.coinbase_premium_pct
  const cbpVal = fmtP(cbp, 3)
  const cbpCls = cbp != null ? (cbp > 0 ? 'text-up' : 'text-down') : ''

  // Mempool: default color
  const mempoolVal = fmtN(mem.count)
  const mempoolSub = `手数料 ${mem.fee_fast || '?'} sat/vB`

  // P/C: color = >1.5 ? red : <0.8 ? green : default
  const pc = vol.pc_ratio
  const pcVal = fmt(pc, 2)
  const pcSub = pc != null ? (pc > 1 ? 'プット優勢 (下落警戒)' : 'コール優勢 (上昇期待)') : ''
  const pcCls = pc != null ? (pc > 1.5 ? 'text-down' : pc < 0.8 ? 'text-up' : '') : ''

  // ETF Flow: color = >0 ? green : red
  const etfDaily = etf.daily_total_musd
  const etfVal = etfDaily != null ? `${etfDaily > 0 ? '+' : ''}$${Math.abs(etfDaily).toFixed(1)}M` : '—'
  const etfSub = etfDaily != null ? (etfDaily > 0 ? '機関流入' : '機関流出') : ''
  const etfCls = etfDaily != null ? (etfDaily > 0 ? 'text-up' : 'text-down') : ''

  // 取引所 Flow net: color = <0 ? green : red
  const netUsd = ef.net_usd
  const efVal = netUsd != null ? fmtM(netUsd) : '—'
  const efSub = netUsd != null ? (netUsd < 0 ? '引出超 (蓄積)' : '流入超 (売り圧)') : ''
  const efCls = netUsd != null ? (netUsd < 0 ? 'text-up' : 'text-down') : ''

  // ── condensed funding-rate table (same 5 coins, same fields) ──
  const frRows: FrSummaryRow[] = []
  for (const coin of ['BTC', 'ETH', 'SOL', 'XRP', 'BNB'] as const) {
    const a = fr[coin]
    if (!a) continue
    frRows.push({
      coin,
      avg: a.avg ?? null,
      max: a.max ?? null,
      min: a.min ?? null,
      spread: a.spread ?? null,
      n_exchanges: a.n_exchanges ?? null,
    })
  }

  const frCols: Column<FrSummaryRow>[] = [
    { key: 'coin', header: '銘柄', align: 'left', cell: (r) => <span className="font-semibold text-ink">{r.coin}</span> },
    { key: 'avg', header: '平均 FR', align: 'right', heat: (r) => r.avg, heatScale: 0.0008, cell: (r) => fmtP(r.avg) },
    { key: 'max', header: '最大', align: 'right', cell: (r) => <span className="text-down">{fmtP(r.max)}</span> },
    { key: 'min', header: '最小', align: 'right', cell: (r) => <span className="text-cool">{fmtP(r.min)}</span> },
    { key: 'spread', header: '乖離幅', align: 'right', cell: (r) => <span className="text-ink-dim">{fmtP(r.spread)}</span> },
    { key: 'n', header: '取引所数', align: 'right', cell: (r) => <span className="text-ink-muted">{r.n_exchanges ?? '—'}</span> },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* AI分析パネル（ナラティブ + カテゴリ別シグナル — 内容は従来と同一） */}
      <AnalysisPanel d={d} />

      {/* 市場シグナル バナー */}
      <SignalBanner signal={signal} score={score} price={d.btc_price ?? null} />

      {/* メトリクスグリッド */}
      <Panel>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
          <Metric label="BTC ドミナンス" value={tint('text-accent', dominanceVal)} />
          <Metric label="DVOL ≈ BVX" value={tint(dvolCls, dvolVal)} sub={dvolSub} />
          <Metric label="FR 平均 (BTC 12取引所)" value={tint(frCls, frVal)} sub={frSub} />
          <Metric label="CB Premium" value={tint(cbpCls, cbpVal)} />
        </div>
      </Panel>

      <Panel>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
          <Metric label="Mempool TX数" value={mempoolVal} sub={mempoolSub} />
          <Metric label="P/C Ratio (Deribit)" value={tint(pcCls, pcVal)} sub={pcSub} />
          <Metric label="ETF Flow (昨日)" value={tint(etfCls, etfVal)} sub={etfSub} />
          <Metric label="取引所 Flow (net)" value={tint(efCls, efVal)} sub={efSub} />
        </div>
      </Panel>

      {/* FR概要テーブル */}
      <Panel
        title="Funding Rate 概要"
        action={<Badge tone="muted" size="sm">主要銘柄 · 12取引所平均</Badge>}
      >
        <DataTable
          columns={frCols}
          rows={frRows}
          rowKey={(r) => r.coin}
          minWidth={520}
          caption="主要銘柄の資金調達率サマリー"
        />
      </Panel>
    </div>
  )
}

export default TabOverview
