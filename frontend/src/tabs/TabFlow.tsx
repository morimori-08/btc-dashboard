'use client'

// ============================================================
// TabFlow — REBUILT with the ui/ design-system primitives.
// Data parity: same ETF Custody Flow block (net flow + latest_date,
// 累積純資産, top-5 ETF別フロー bars), the same Exchange Flow block
// (net + border direction, inflow/outflow, BTC残高), and the same
// stablecoin 3-up. Every value, conditional and color direction kept.
// The ETF-per-ticker bars are single scalars (not a series) so they
// remain inline magnitude bars rather than a Sparkline.
// ============================================================

import { Panel, Metric } from '@/components/ui'
import { fmtM, fmtB } from '../lib/dashboard'

export function TabFlow({ d }: { d: any }) {
  const etf    = d.etf_flow || {}
  const ef     = d.exchange_flow || {}
  const sc     = d.stablecoins || {}
  const tickers        = etf.tickers || {}
  const tickerEntries  = Object.entries(tickers).filter(([k]) => k !== 'Total') as [string, number][]

  const etfNetCls = etf.daily_total_musd != null ? (etf.daily_total_musd > 0 ? 'text-up' : 'text-down') : ''
  const efNetCls  = ef.net_usd != null ? (ef.net_usd < 0 ? 'text-up' : 'text-down') : ''
  // Net Flow border direction (decorative, preserved from the old GlassCard borderColor).
  const efBorder  =
    ef.net_usd != null
      ? ef.net_usd < 0
        ? 'border-[rgba(45,190,132,0.3)]'
        : 'border-[rgba(240,93,114,0.3)]'
      : ''
  const scCls = sc.weekly_change_pct != null ? (sc.weekly_change_pct > 0 ? 'text-up' : 'text-down') : ''

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* ── ETF Custody Flow ── */}
        <Panel title="ETF Custody Flow" accent action={<span className="text-2xs text-ink-muted">機関投資家フロー</span>}>
          <div className="flex flex-col gap-4">
            <Metric
              label="ネットフロー (昨日)"
              value={
                <span className={etfNetCls}>
                  {etf.daily_total_musd != null
                    ? `${etf.daily_total_musd > 0 ? '+' : ''}$${Math.abs(etf.daily_total_musd).toFixed(1)}M`
                    : '—'}
                </span>
              }
              sub={etf.latest_date || '—'}
            />
            <Metric label="累積純資産" value={<span className="text-accent">{fmtB(etf.cumulative_usd)}</span>} />

            {tickerEntries.length > 0 && (
              <div>
                <div className="mb-2.5 text-2xs font-medium uppercase tracking-label text-ink-muted">ETF別フロー ($M)</div>
                <div className="flex flex-col gap-1.5">
                  {tickerEntries
                    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                    .slice(0, 5)
                    .map(([k, v]) => {
                      const max = Math.max(...tickerEntries.map(([, x]) => Math.abs(x)), 1)
                      const w = (Math.abs(v) / max) * 100
                      return (
                        <div key={k} className="flex items-center gap-2">
                          <span className="min-w-[40px] text-[0.72rem] font-bold text-ink">{k}</span>
                          <div className="relative h-5 flex-1 overflow-hidden rounded bg-[rgba(255,255,255,0.04)]">
                            <div
                              className="h-full rounded"
                              style={{
                                width: `${w}%`,
                                background: v > 0
                                  ? 'linear-gradient(90deg,rgba(45,190,132,0.3),rgba(45,190,132,0.15))'
                                  : 'linear-gradient(90deg,rgba(240,93,114,0.3),rgba(240,93,114,0.15))',
                                boxShadow: v > 0
                                  ? 'inset 0 0 8px rgba(45,190,132,0.2)'
                                  : 'inset 0 0 8px rgba(240,93,114,0.2)',
                              }}
                            />
                          </div>
                          <span className={`min-w-[56px] text-right font-mono text-[0.72rem] tabular ${v > 0 ? 'text-up' : 'text-down'}`}>
                            {v > 0 ? '+' : ''}{v.toFixed(1)}
                          </span>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        </Panel>

        {/* ── Exchange Flow ── */}
        <Panel title="取引所 Flow (Coinmetrics)" accent action={<span className="text-2xs text-ink-muted">オンチェーン資金移動</span>}>
          <div className="flex flex-col gap-4">
            <div className={`rounded-core border p-3 ${efBorder}`}>
              <Metric
                label="Net Flow (取引所出入)"
                value={<span className={efNetCls}>{ef.net_usd != null ? fmtM(ef.net_usd) : '—'}</span>}
                sub={ef.net_usd != null ? (ef.net_usd < 0 ? '引出超 → BTC蓄積 (強気)' : '流入超 → 売り圧力 (弱気)') : ''}
              />
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <Metric label="流入 (Inflow)" value={<span className="text-down">{fmtM(ef.inflow_usd)}</span>} />
              <Metric label="流出 (Outflow)" value={<span className="text-up">{fmtM(ef.outflow_usd)}</span>} />
            </div>
            <Metric
              label="取引所 BTC 残高"
              value={<span className="text-accent">{ef.exchange_balance_btc != null ? `${(ef.exchange_balance_btc / 1000).toFixed(0)}K BTC` : '—'}</span>}
            />
          </div>
        </Panel>
      </div>

      {/* ── ステーブルコイン供給 ── */}
      <Panel title="ステーブルコイン供給" accent action={<span className="text-2xs text-ink-muted">市場流動性指標</span>}>
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-3">
          <Metric label="USDT 発行残高" value={fmtB(sc.usdt_usd)} />
          <Metric label="USDC 発行残高" value={fmtB(sc.usdc_usd)} />
          <Metric
            label="USD系 合計"
            value={scCls ? <span className={scCls}>{fmtB(sc.total_usd)}</span> : fmtB(sc.total_usd)}
            sub={sc.weekly_change_pct != null ? `週次変化 ${sc.weekly_change_pct > 0 ? '+' : ''}${sc.weekly_change_pct.toFixed(2)}%` : ''}
          />
        </div>
      </Panel>
    </div>
  )
}

export default TabFlow
