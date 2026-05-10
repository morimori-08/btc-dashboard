'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchLatest, fetchTechnical } from '../lib/api'

// カラーパレット (ダーク)
const C = {
  bg: '#0f1117', card: '#1e2130', border: '#2d3250',
  green: '#26a69a', red: '#ef5350',
  text: '#e0e0e0', muted: '#9aa0b4',
  bull: '#4dff88', bear: '#ff6666',
}

// ==================== 共通コンポーネント ====================

function MetricCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: '12px 16px', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '0.72rem', color: C.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: color || C.text, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.7rem', color: C.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function SignalBanner({ signal, score, price }: { signal: string; score: number; price: number }) {
  const isBull = signal === 'BULL'
  const isBear = signal === 'BEAR'
  const bg = isBull ? 'linear-gradient(135deg,#0d3318,#1a5c2e)'
             : isBear ? 'linear-gradient(135deg,#330d0d,#5c1a1a)'
             : 'linear-gradient(135deg,#1e1e2e,#2a2a3e)'
  const color = isBull ? C.bull : isBear ? C.bear : '#aac'
  const icon = isBull ? '📈' : isBear ? '📉' : '➡️'
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '12px 16px',
                  textAlign: 'center', color, fontWeight: 700, fontSize: '1.05rem', marginBottom: 12 }}>
      {icon} 総合シグナル: <b>{signal}</b> &nbsp;|&nbsp; スコア {score > 0 ? '+' : ''}{score.toFixed(1)}/3.0
      &nbsp;|&nbsp; BTC <b>${price?.toLocaleString()}</b>
    </div>
  )
}

// ==================== タブコンポーネント ====================

const TABS = ['📊概要','💰FR/OI','📈ボラ','🌊フロー','🌐マクロ','💥清算','📐テクニカル','💣清算MAP','📊変化率']

// ==================== メインページ ====================

export default function Page() {
  const [data, setData] = useState<any>(null)
  const [tech, setTech] = useState<any>(null)
  const [tab, setTab] = useState(0)
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [d, t] = await Promise.all([fetchLatest(), fetchTechnical()])
    setData(d)
    setTech(t)
    setLastUpdate(new Date().toLocaleTimeString('ja-JP'))
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 60000)  // 60秒毎に更新
    return () => clearInterval(timer)
  }, [refresh])

  const d = data || {}
  const vol = d.vol || {}
  const etf = d.etf_flow || {}
  const ef  = d.exchange_flow || {}
  const sc  = d.stablecoins || {}
  const mac = d.macro || {}
  const fr  = d.fr_aggregate || {}
  const liq = d.liquidations || {}
  const sig = tech?.signal || 'NEUTRAL'
  const score = tech?.composite_score || 0

  const fmt = (v: number | null | undefined, decimals = 2) =>
    v == null ? 'N/A' : v.toFixed(decimals)
  const fmtPct = (v: number | null | undefined, decimals = 4) =>
    v == null ? 'N/A' : `${(v * 100) > 0 ? '+' : ''}${(v * 100).toFixed(decimals)}%`
  const fmtM = (v: number | null | undefined) =>
    v == null ? 'N/A' : `$${(v / 1e6).toFixed(0)}M`
  const fmtB = (v: number | null | undefined) =>
    v == null ? 'N/A' : `$${(v / 1e9).toFixed(1)}B`

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 8px 80px' }}>
      {/* Header */}
      <div style={{ padding: '8px 0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>₿ BTC Dashboard</span>
        <span style={{ fontSize: '0.72rem', color: C.muted }}>
          {loading ? '更新中...' : `更新: ${lastUpdate}`}
          <button onClick={refresh} style={{ marginLeft: 8, background: 'none', border: `1px solid ${C.border}`,
            color: C.muted, borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: '0.72rem' }}>
            ↻
          </button>
        </span>
      </div>

      {/* Signal Banner */}
      <SignalBanner signal={sig} score={score} price={d.btc_price} />

      {/* Tab bar (スクロール可) */}
      <div style={{ display: 'flex', overflowX: 'auto', gap: 4, marginBottom: 12,
                    borderBottom: `1px solid ${C.border}`, paddingBottom: 4 }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)}
            style={{ whiteSpace: 'nowrap', padding: '6px 10px', borderRadius: '6px 6px 0 0',
                     background: tab === i ? C.card : 'none',
                     border: tab === i ? `1px solid ${C.border}` : '1px solid transparent',
                     color: tab === i ? C.text : C.muted, cursor: 'pointer', fontSize: '0.8rem' }}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab 0: 概要 */}
      {tab === 0 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 8 }}>
            <MetricCard label="₿ BTC価格" value={d.btc_price ? `$${d.btc_price.toLocaleString(undefined,{maximumFractionDigits:0})}` : 'N/A'} />
            <MetricCard label="🌐 ドミナンス" value={d.btc_dominance ? `${fmt(d.btc_dominance)}%` : 'N/A'} />
            <MetricCard label="📈 DVOL (≈BVX)" value={fmt(vol.dvol, 1)}
                        sub={`HV=${fmt(vol.realized_vol,1)}  VRP=${vol.vrp ? (vol.vrp>0?'+':'')+fmt(vol.vrp,1) : 'N/A'}`} />
            <MetricCard label="💰 FR平均(BTC)" value={fmtPct(fr.BTC?.avg)}
                        color={(fr.BTC?.avg || 0) > 0 ? C.red : '#4488ff'}
                        sub={(fr.BTC?.avg || 0) > 0 ? '🔴 ロング偏重' : '🔵 ショート偏重'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
            <MetricCard label="⛓ Mempool TX" value={d.mempool?.count?.toLocaleString() || 'N/A'}
                        sub={`手数料 ${d.mempool?.fee_fast || '?'} sat/vB`} />
            <MetricCard label="🏦 CB Premium" value={fmtPct(d.coinbase_premium_pct, 3)} />
            <MetricCard label="📦 ETF Flow (昨日)"
                        value={etf.daily_total_musd != null ? `$${etf.daily_total_musd > 0 ? '+' : ''}${etf.daily_total_musd.toFixed(1)}M` : 'N/A'}
                        color={(etf.daily_total_musd || 0) > 0 ? C.green : C.red}
                        sub={(etf.daily_total_musd || 0) > 0 ? '流入 🟢' : '流出 🔴'} />
            <MetricCard label="🔄 取引所Flow(net)"
                        value={fmtM(ef.net_usd)}
                        color={(ef.net_usd || 0) < 0 ? C.green : C.red}
                        sub={(ef.net_usd || 0) < 0 ? '引出超 🟢' : '流入超 🔴'} />
          </div>
        </div>
      )}

      {/* Tab 1: FR/OI */}
      {tab === 1 && (
        <div>
          <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Funding Rate (全取引所平均)</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: C.card }}>
                  {['銘柄','平均FR','最大','最小','乖離幅','取引所数'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'right', color: C.muted, fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(fr).map(([coin, agg]: [string, any]) => {
                  const avg = agg.avg || 0
                  const rowColor = avg > 0.0003 ? '#4d1a1a' : avg < -0.0003 ? '#1a1a4d' : C.card
                  return (
                    <tr key={coin} style={{ background: rowColor, borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '5px 8px', fontWeight: 600 }}>{coin}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right',
                                   color: avg > 0 ? C.red : '#4488ff' }}>
                        {fmtPct(avg)}
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: C.red }}>{fmtPct(agg.max)}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: '#4488ff' }}>{fmtPct(agg.min)}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right' }}>{fmtPct(agg.spread)}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: C.muted }}>{agg.n_exchanges}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: ボラ */}
      {tab === 2 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
            <MetricCard label="📈 DVOL (≈BVX)" value={fmt(vol.dvol, 1)} />
            <MetricCard label="📊 実現ボラ (HV)" value={fmt(vol.realized_vol, 1)} />
            <MetricCard label="⚡ VRP (DVOL-HV)" value={vol.vrp != null ? `${vol.vrp > 0 ? '+' : ''}${fmt(vol.vrp, 1)}pt` : 'N/A'}
                        color={(vol.vrp || 0) > 5 ? C.red : C.green} />
            <MetricCard label="📉 先物プレミアム" value={vol.futures_premium_pct != null ? `${(vol.futures_premium_pct*100).toFixed(3)}%` : 'N/A'} />
            <MetricCard label="🔵 P/C Ratio" value={fmt(vol.pc_ratio, 2)}
                        sub={(vol.pc_ratio || 0) > 1 ? '>1 プット優勢' : 'コール優勢'} />
            <MetricCard label="↕️ RR 7DTE" value={vol.rr_7d != null ? `${fmt(vol.rr_7d, 2)} vol` : 'N/A'}
                        color={(vol.rr_7d || 0) < -2 ? C.red : C.green} />
          </div>
          {vol.term_structure && (
            <div style={{ marginTop: 12 }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: C.muted }}>ターム構造 (IV%)</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(vol.term_structure).map(([dte, iv]: [string, any]) => (
                  <div key={dte} style={{ background: C.card, border: `1px solid ${C.border}`,
                                          borderRadius: 6, padding: '6px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: C.muted }}>{dte}D</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700 }}>{fmt(iv, 1)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: フロー */}
      {tab === 3 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 12 }}>
            <MetricCard label="📦 ETF Flow (昨日)"
                        value={etf.daily_total_musd != null ? `${etf.daily_total_musd > 0 ? '+' : ''}$${etf.daily_total_musd?.toFixed(1)}M` : 'N/A'}
                        color={(etf.daily_total_musd || 0) > 0 ? C.green : C.red} />
            <MetricCard label="💎 ETF累積純資産" value={fmtB(etf.cumulative_usd)} />
            <MetricCard label="🔄 取引所Flow(net)" value={fmtM(ef.net_usd)}
                        color={(ef.net_usd || 0) < 0 ? C.green : C.red}
                        sub={(ef.net_usd || 0) < 0 ? '引出超 🟢 強気' : '流入超 🔴 弱気'} />
            <MetricCard label="🏦 取引所BTC残高" value={ef.exchange_balance_btc ? `${(ef.exchange_balance_btc/1e6*1000).toFixed(0)}K BTC` : 'N/A'} />
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: C.muted }}>Stablecoin Supply</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            <MetricCard label="USDT" value={fmtB(sc.usdt_usd)} />
            <MetricCard label="USDC" value={fmtB(sc.usdc_usd)} />
            <MetricCard label="合計" value={fmtB(sc.total_usd)}
                        sub={sc.weekly_change_pct != null ? `週変化: ${sc.weekly_change_pct > 0 ? '+' : ''}${sc.weekly_change_pct.toFixed(2)}%` : ''} />
          </div>
        </div>
      )}

      {/* Tab 4: マクロ */}
      {tab === 4 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
          <MetricCard label="📊 S&P500 (SPY)" value={mac.spy ? `$${mac.spy.toFixed(2)}` : 'N/A'} />
          <MetricCard label="🥇 Gold (GLD)" value={mac.gld ? `$${mac.gld.toFixed(2)}` : 'N/A'} />
          <MetricCard label="🛢 原油 (CL=F)" value={mac.oil ? `$${mac.oil.toFixed(2)}` : 'N/A'} />
          <MetricCard label="📉 米10年金利" value={mac.us10y ? `${mac.us10y.toFixed(3)}%` : 'N/A'} />
          <MetricCard label="📉 米2年金利" value={mac.us02y ? `${mac.us02y.toFixed(3)}%` : 'N/A'} />
          <MetricCard label="📏 イールドスプレッド" value={mac.yield_spread != null ? `${mac.yield_spread > 0 ? '+' : ''}${mac.yield_spread.toFixed(3)}%` : 'N/A'}
                      color={(mac.yield_spread || 0) > 0 ? C.green : C.red} />
        </div>
      )}

      {/* Tab 5: 清算 */}
      {tab === 5 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 12 }}>
            <MetricCard label="OKX ショート清算" value={liq.okx_short_liq_btc != null ? `${liq.okx_short_liq_btc.toFixed(1)} BTC` : 'N/A'} color={C.green} />
            <MetricCard label="OKX ロング清算" value={liq.okx_long_liq_btc != null ? `${liq.okx_long_liq_btc.toFixed(1)} BTC` : 'N/A'} color={C.red} />
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: C.muted }}>BTC Taker Buy/Sell比率 (Binance)</h3>
          {(() => {
            const taker = liq.bn_taker_ls || {}
            return (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: C.card }}>
                      {['銘柄','Buy出来高','Sell出来高','Buy/Sell比','方向'].map(h => (
                        <th key={h} style={{ padding: '5px 8px', textAlign: 'right', color: C.muted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(taker).slice(0,10).map(([coin, t]: [string, any]) => (
                      <tr key={coin} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '5px 8px', fontWeight: 600 }}>{coin}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right' }}>{(t as any).buy_vol?.toFixed(0)}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right' }}>{(t as any).sell_vol?.toFixed(0)}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right',
                                     color: ((t as any).ratio||0) > 1 ? C.green : C.red }}>
                          {(t as any).ratio?.toFixed(4)}
                        </td>
                        <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                          {((t as any).ratio||0) > 1 ? '🟢買超' : '🔴売超'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })()}
        </div>
      )}

      {/* Tab 6: テクニカル */}
      {tab === 6 && tech && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 12 }}>
            {['1h','4h','1d','1w'].map(tf => {
              const t = tech[tf] || {}
              const score = t.trend_score || 0
              return (
                <div key={tf} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6, color: score > 0 ? C.bull : score < 0 ? C.bear : C.muted }}>
                    {tf.toUpperCase()} &nbsp;
                    {'▲'.repeat(Math.max(0, score))}{'▼'.repeat(Math.max(0, -score))}
                    &nbsp;{score > 0 ? '+' : ''}{score}
                  </div>
                  <div style={{ fontSize: '0.78rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {[
                      ['SMA20', t.sma20, t.vs_sma20],
                      ['SMA75', t.sma75, t.vs_sma75],
                      ['SMA200', t.sma200, t.vs_sma200],
                      ['RSI14', t.rsi14, null],
                    ].map(([label, val, vs]) => (
                      <div key={label as string}>
                        <span style={{ color: C.muted }}>{label as string}: </span>
                        <span style={{ color: vs === 'above' ? C.green : vs === 'below' ? C.red : C.text }}>
                          ${(val as number)?.toLocaleString(undefined, {maximumFractionDigits: 0})}
                          {vs === 'above' ? ' ✅' : vs === 'below' ? ' ❌' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tab 7: 清算MAP */}
      {tab === 7 && (
        <div>
          {(() => {
            const lh = d.liq_heatmap || {}
            const kl = lh.key_levels || {}
            const price = d.btc_price || 80000
            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 12 }}>
                  <MetricCard label="ロング最大清算↓" value={kl.major_long_liq_below ? `$${kl.major_long_liq_below.toLocaleString()}` : 'N/A'}
                              sub={kl.major_long_liq_below ? `現在価格から -$${(price-kl.major_long_liq_below).toLocaleString(undefined,{maximumFractionDigits:0})}` : ''}
                              color={C.red} />
                  <MetricCard label="ショート最大清算↑" value={kl.major_short_liq_above ? `$${kl.major_short_liq_above.toLocaleString()}` : 'N/A'}
                              sub={kl.major_short_liq_above ? `現在価格から +$${(kl.major_short_liq_above-price).toLocaleString(undefined,{maximumFractionDigits:0})}` : ''}
                              color={C.green} />
                  <MetricCard label="推定ロング清算総額" value={lh.total_long_liq_est_usd ? `$${(lh.total_long_liq_est_usd/1e6).toFixed(0)}M` : 'N/A'} color={C.red} />
                  <MetricCard label="推定ショート清算総額" value={lh.total_short_liq_est_usd ? `$${(lh.total_short_liq_est_usd/1e6).toFixed(0)}M` : 'N/A'} color={C.green} />
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: C.muted }}>清算水準</h3>
                {(lh.liq_levels || []).sort((a: any, b: any) => b.price_level - a.price_level).map((lv: any) => {
                  const isAbove = lv.price_level > price
                  const size = isAbove ? lv.short_liq_btc : lv.long_liq_btc
                  const max = Math.max(...(lh.liq_levels || []).map((x: any) => Math.max(x.long_liq_btc, x.short_liq_btc)), 1)
                  const pct = (size / max * 100).toFixed(0)
                  return (
                    <div key={lv.price_level} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ minWidth: 80, fontSize: '0.78rem', color: lv.price_level > price ? C.green : C.red }}>
                        ${lv.price_level.toLocaleString()}
                      </span>
                      <div style={{ flex: 1, height: 16, background: '#2a2a3a', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ width: `${pct}%`, height: '100%',
                                      background: isAbove ? C.green : C.red, opacity: 0.7 }} />
                        {lv.price_level === price && (
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                        border: `2px solid yellow` }} />
                        )}
                      </div>
                      <span style={{ minWidth: 60, fontSize: '0.72rem', color: C.muted, textAlign: 'right' }}>
                        {size?.toFixed(0)} BTC
                      </span>
                    </div>
                  )
                })}
              </>
            )
          })()}
        </div>
      )}

      {/* Tab 8: 変化率 */}
      {tab === 8 && (
        <div>
          <h3 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: C.muted }}>前日/前週/前月比</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: C.card }}>
                  {['データ','現在値','前日比','前週比','前月比'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'right', color: C.muted, fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(d.changes || {}).map(([key, ch]: [string, any]) => {
                  const chgColor = (v: number | null) => !v ? C.muted : v > 0 ? C.green : C.red
                  const chgFmt = (v: number | null, raw: number | null) => {
                    if (v == null) return '—'
                    const sign = v > 0 ? '+' : ''
                    return `${sign}${Math.abs(raw || 0) > 1e8 ? (v/1e6).toFixed(0)+'M' : v.toFixed(2)}%`
                  }
                  return (
                    <tr key={key} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '5px 8px', color: C.muted, fontSize: '0.75rem' }}>{key}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {ch.now?.toLocaleString(undefined, {maximumFractionDigits: 2}) ?? '—'}
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: chgColor(ch.chg_24h) }}>
                        {ch.chg_24h != null ? `${ch.chg_24h > 0 ? '+' : ''}${ch.chg_24h.toFixed(2)}%` : '—'}
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: chgColor(ch.chg_7d) }}>
                        {ch.chg_7d != null ? `${ch.chg_7d > 0 ? '+' : ''}${ch.chg_7d.toFixed(2)}%` : '—'}
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: chgColor(ch.chg_30d) }}>
                        {ch.chg_30d != null ? `${ch.chg_30d > 0 ? '+' : ''}${ch.chg_30d.toFixed(2)}%` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bottom padding for mobile */}
      <div style={{ height: 40 }} />
    </div>
  )
}
