'use client'

// ============================================================
// TabVol: REBUILT with the ui/ design-system primitives
// (Panel / Metric / Sparkline). Data parity with the former inline TabVol:
// the 6 volatility metrics (DVOL, HV, VRP, futures premium, P/C, RR 7DTE)
// and the implied-vol term-structure (per-DTE IV bars + values + labels +
// the same color thresholds). Only the structure/visuals changed.
// A Sparkline of the ordered IV series is added as an at-a-glance trend
// (additive: no per-bar value/label/color is dropped).
// ============================================================

import { type ReactNode } from 'react'
import { Panel, Metric, Sparkline } from '@/components/ui'
import { fmt } from '../lib/dashboard'

export function TabVol({ d }: { d: any }) {
  const vol    = d.vol || {}
  const ts     = vol.term_structure || {}
  const tsDays = Object.keys(ts).map(Number).sort((a, b) => a - b)

  // ── tint helper (same pattern as TabOverview): wrap the value string in the
  // matching color token so the exact same string shows with the same intent.
  const tint = (cls: string, node: ReactNode) =>
    cls ? <span className={cls}>{node}</span> : node

  // DVOL: color="btc" → accent
  const dvolVal = fmt(vol.dvol, 1)

  // 実現ボラ (HV): default color
  const hvVal = fmt(vol.realized_vol, 1)

  // VRP: >8 ? red : <2 ? green : default
  const vrp = vol.vrp
  const vrpVal = vrp != null ? `${vrp > 0 ? '+' : ''}${fmt(vrp, 1)}pt` : '—'
  const vrpCls = vrp != null ? (vrp > 8 ? 'text-down' : vrp < 2 ? 'text-up' : '') : ''
  const vrpSub = vrp != null ? (vrp > 8 ? 'IVが割高 (売り圧注意)' : vrp < 2 ? 'IVが安い' : '標準') : ''

  // 先物プレミアム: >0 ? green : red
  const fp = vol.futures_premium_pct
  const fpVal = fp != null ? `${(fp * 100).toFixed(3)}%` : '—'
  const fpCls = fp != null ? (fp > 0 ? 'text-up' : 'text-down') : ''
  const fpSub = fp != null ? (fp > 0 ? 'コンタンゴ (強気)' : 'バックワーデーション (弱気)') : ''

  // P/C Ratio: >1.5 ? red : <0.8 ? green : default
  const pc = vol.pc_ratio
  const pcVal = fmt(pc, 2)
  const pcCls = pc != null ? (pc > 1.5 ? 'text-down' : pc < 0.8 ? 'text-up' : '') : ''
  const pcSub = pc != null ? (pc > 1 ? 'プット優勢 (恐怖)' : 'コール優勢 (楽観)') : ''

  // Risk Reversal 7DTE: <-3 ? red : >1 ? green : default
  const rr = vol.rr_7d
  const rrVal = rr != null ? `${fmt(rr, 2)} vol` : '—'
  const rrCls = rr != null ? (rr < -3 ? 'text-down' : rr > 1 ? 'text-up' : '') : ''

  // ── term-structure series for the Sparkline (ordered by DTE, numeric only) ──
  const tsSeries = tsDays
    .map((dte) => ts[dte.toString()] as number)
    .filter((v) => v != null && !Number.isNaN(v))

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-3">
          <Metric label="DVOL (≈ BVX)" value={tint('text-accent', dvolVal)} sub="Deribit 30D Implied Vol" />
          <Metric label="実現ボラ (HV)" value={hvVal} sub="Historical Volatility" />
          <Metric label="VRP (DVOL − HV)" value={tint(vrpCls, vrpVal)} sub={vrpSub} />
        </div>
      </Panel>

      <Panel>
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-3">
          <Metric label="先物プレミアム" value={tint(fpCls, fpVal)} sub={fpSub} />
          <Metric label="P/C Ratio" value={tint(pcCls, pcVal)} sub={pcSub} />
          <Metric label="Risk Reversal 7DTE" value={tint(rrCls, rrVal)} />
        </div>
      </Panel>

      {/* ターム構造 */}
      {tsDays.length > 0 && (
        <Panel
          title="インプライドボラ ターム構造"
          accent
          action={
            tsSeries.length >= 2 ? (
              <Sparkline data={tsSeries} tone="accent" width={96} height={22} aria-label="IV term structure trend" />
            ) : null
          }
        >
          <div className="flex h-40 items-end justify-center gap-3">
            {tsDays.map((dte) => {
              const iv    = ts[dte.toString()] as number
              const maxIV = Math.max(...tsDays.map((d2: number) => (ts[d2.toString()] as number) || 0))
              const h     = iv ? (iv / maxIV * 120) : 20
              const col   = iv > 50 ? 'var(--red)' : iv > 40 ? 'var(--btc)' : 'var(--cyan)'
              return (
                <div key={dte} className="flex flex-col items-center gap-1.5">
                  <div className="tabular font-mono text-[0.75rem] font-bold" style={{ color: col }}>
                    {iv?.toFixed(1)}
                  </div>
                  <div
                    style={{
                      width: 36,
                      height: h,
                      background: `linear-gradient(180deg,${col},${col}44)`,
                      borderRadius: '4px 4px 0 0',
                      boxShadow: `0 0 12px ${col}44`,
                    }}
                  />
                  <div className="text-2xs text-ink-muted">{dte}D</div>
                </div>
              )
            })}
          </div>
        </Panel>
      )}
    </div>
  )
}

export default TabVol
