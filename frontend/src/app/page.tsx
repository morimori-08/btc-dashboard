'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchLatest } from '../lib/api'

// ============================================================
// 定数
// ============================================================

const TABS = [
  { id: 'overview',    label: '概要',       icon: '◈' },
  { id: 'fr',          label: 'FR/OI',      icon: '◉' },
  { id: 'vol',         label: 'ボラ',       icon: '◬' },
  { id: 'flow',        label: 'フロー',     icon: '◭' },
  { id: 'macro',       label: 'マクロ',     icon: '◍' },
  { id: 'history',     label: '履歴',       icon: '◷' },
  { id: 'liq',         label: '清算',       icon: '◤' },
  { id: 'tech',        label: 'テクニカル', icon: '◈' },
  { id: 'liqmap',      label: '清算MAP',    icon: '◉' },
  { id: 'changes',     label: '変化率',     icon: '◭' },
]

const TOP15 = ['BTC','ETH','XRP','BNB','SOL','TRX','DOGE','HYPE','ADA','LINK','TON','LTC','AVAX','DOT','UNI']
const OI_EXCHANGES = ['binance','bybit','okx','hyperliquid','gate']

// ============================================================
// ユーティリティ
// ============================================================

const fmt  = (v: number | null | undefined, d = 2): string =>
  v == null ? '—' : v.toFixed(d)

const fmtP = (v: number | null | undefined, d = 4): string =>
  v == null ? '—' : `${(v * 100) >= 0 ? '+' : ''}${(v * 100).toFixed(d)}%`

const fmtM = (v: number | null | undefined): string =>
  v == null ? '—' : `$${(v / 1e6).toFixed(0)}M`

const fmtB = (v: number | null | undefined): string =>
  v == null ? '—' : `$${(v / 1e9).toFixed(1)}B`

const fmtN = (v: number | null | undefined): string =>
  v == null ? '—' : v.toLocaleString(undefined, { maximumFractionDigits: 0 })

function frClass(v: number | null | undefined): string {
  if (v == null) return ''
  const pct = v * 100
  if (pct >  0.005)  return 'fr-strong-pos'
  if (pct >  0.002)  return 'fr-mid-pos'
  if (pct >  0.0005) return 'fr-weak-pos'
  if (pct < -0.005)  return 'fr-strong-neg'
  if (pct < -0.002)  return 'fr-mid-neg'
  if (pct < -0.0005) return 'fr-weak-neg'
  return 'fr-neutral'
}

// ============================================================
// コンポーネント
// ============================================================

function GlassCard({ children, style, className }: {
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

type MetricColor = 'default' | 'btc' | 'green' | 'red' | 'cyan'

function MetricCard({ label, value, sub, color, accent }: {
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

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
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

function Badge({ label, type = 'muted' }: { label: string; type?: 'green' | 'red' | 'btc' | 'cyan' | 'muted' }) {
  return <span className={`badge badge-${type}`}>{label}</span>
}

// ============================================================
// AI分析エンジン（ルールベース）
// ============================================================

type Signal = { label: string; value: string; verdict: 'bull' | 'bear' | 'neutral'; weight: number; reason: string }

function buildSignals(d: any): Signal[] {
  const signals: Signal[] = []
  const fr   = d.fr_aggregate  || {}
  const liq  = d.liquidations  || {}
  const vol  = d.vol           || {}
  const etf  = d.etf_flow      || {}
  const ef   = d.exchange_flow || {}
  const tech = d.technical     || {}
  const lh   = d.liq_heatmap   || {}
  const mac  = d.macro         || {}
  const kl   = lh.key_levels   || {}
  const price = d.btc_price    || 0

  // ── FR (BTC) ──────────────────────────────────────────────
  const frBtc = fr.BTC?.avg
  if (frBtc != null) {
    if (frBtc > 0.05)
      signals.push({ label: 'BTC FR', value: `+${(frBtc * 100).toFixed(3)}%`, verdict: 'bear', weight: 3,
        reason: '過熱ゾーン。ロングポジションが積み過ぎ → 強制決済・急落リスク高' })
    else if (frBtc > 0.02)
      signals.push({ label: 'BTC FR', value: `+${(frBtc * 100).toFixed(3)}%`, verdict: 'neutral', weight: 1,
        reason: '強気バイアスあり。上昇継続余地はあるが過熱に近づいている' })
    else if (frBtc < -0.01)
      signals.push({ label: 'BTC FR', value: `${(frBtc * 100).toFixed(3)}%`, verdict: 'bull', weight: 3,
        reason: 'ショート優位のFR → ショートスクイーズによる急騰トリガーになりやすい' })
    else
      signals.push({ label: 'BTC FR', value: `${(frBtc * 100).toFixed(3)}%`, verdict: 'neutral', weight: 1,
        reason: 'FRは中立。特定方向へのバイアスなし' })
  }

  // ── テクニカル (1H) ────────────────────────────────────────
  const h1 = tech['1h'] || {}
  const d1 = tech['1d'] || {}
  if (h1.vs_sma200) {
    if (h1.vs_sma200 === 'above' && d1.vs_sma200 === 'above')
      signals.push({ label: 'SMA200位置', value: '価格 > SMA200', verdict: 'bull', weight: 2,
        reason: '1H・日足ともにSMA200上方。長期上昇トレンド維持' })
    else if (h1.vs_sma200 === 'below' && d1.vs_sma200 === 'below')
      signals.push({ label: 'SMA200位置', value: '価格 < SMA200', verdict: 'bear', weight: 2,
        reason: '1H・日足ともにSMA200下方。長期下降トレンド継続中' })
  }
  if (h1.rsi14 != null) {
    if (h1.rsi14 > 72)
      signals.push({ label: 'RSI(1H)', value: h1.rsi14.toFixed(1), verdict: 'bear', weight: 2,
        reason: `RSI過買い(${h1.rsi14.toFixed(0)})。短期的な反落・調整が起きやすい水準` })
    else if (h1.rsi14 < 28)
      signals.push({ label: 'RSI(1H)', value: h1.rsi14.toFixed(1), verdict: 'bull', weight: 2,
        reason: `RSI過売り(${h1.rsi14.toFixed(0)})。反発・ショートカバーが起きやすい水準` })
  }

  // ── 清算MAP ────────────────────────────────────────────────
  if (price > 0) {
    const shortAbove = kl.next_short_liq
    const longBelow  = kl.next_long_liq
    if (shortAbove && (shortAbove - price) < price * 0.03)
      signals.push({ label: 'ショート清算帯', value: `$${shortAbove.toLocaleString()}`, verdict: 'bull', weight: 2,
        reason: `現在値から+${(((shortAbove - price) / price) * 100).toFixed(1)}%圏内に大量ショート清算帯。価格がここに達するとスクイーズで急騰しやすい` })
    if (longBelow && (price - longBelow) < price * 0.03)
      signals.push({ label: 'ロング清算帯', value: `$${longBelow.toLocaleString()}`, verdict: 'bear', weight: 2,
        reason: `現在値から-${(((price - longBelow) / price) * 100).toFixed(1)}%圏内に大量ロング清算帯。下抜けると連鎖清算で急落しやすい` })
  }

  // ── 清算方向 ───────────────────────────────────────────────
  const shortLiq = (liq.okx_short_liq_btc || 0) + (liq.binance_short_liq_btc || 0) + (liq.bybit_short_liq_btc || 0)
  const longLiq  = (liq.okx_long_liq_btc  || 0) + (liq.binance_long_liq_btc  || 0) + (liq.bybit_long_liq_btc  || 0)
  if (shortLiq > 0 || longLiq > 0) {
    const ratio = shortLiq / (longLiq + 0.0001)
    if (ratio > 3)
      signals.push({ label: '清算方向', value: `SHORT ×${ratio.toFixed(1)}`, verdict: 'bull', weight: 2,
        reason: `ショート清算がロング清算の${ratio.toFixed(1)}倍。売り方が一方的に焼かれており買い圧力強い` })
    else if (ratio < 0.33)
      signals.push({ label: '清算方向', value: `LONG ×${(1/ratio).toFixed(1)}`, verdict: 'bear', weight: 2,
        reason: `ロング清算がショート清算の${(1/ratio).toFixed(1)}倍。買い方が清算されており売り圧力強い` })
  }

  // ── ETFフロー ──────────────────────────────────────────────
  const etfDaily = etf.daily_total_musd
  if (etfDaily != null) {
    if (etfDaily > 300)
      signals.push({ label: 'ETF Flow', value: `+$${etfDaily.toFixed(0)}M`, verdict: 'bull', weight: 2,
        reason: `機関投資家が${etfDaily.toFixed(0)}M$(${(etfDaily/1000).toFixed(1)}B)を1日でBTC ETFに流入。強い買い需要` })
    else if (etfDaily < -200)
      signals.push({ label: 'ETF Flow', value: `$${etfDaily.toFixed(0)}M`, verdict: 'bear', weight: 2,
        reason: `ETFから${Math.abs(etfDaily).toFixed(0)}M$の流出。機関投資家が利確・撤退している` })
    else if (etfDaily > 50)
      signals.push({ label: 'ETF Flow', value: `+$${etfDaily.toFixed(0)}M`, verdict: 'bull', weight: 1,
        reason: '小規模ながら機関資金の継続流入。買い圧力が続いている' })
  }

  // ── 取引所フロー ───────────────────────────────────────────
  const netFlow = ef.net_usd
  if (netFlow != null) {
    if (netFlow < -100_000_000)
      signals.push({ label: '取引所流出', value: `-$${(Math.abs(netFlow)/1e6).toFixed(0)}M`, verdict: 'bull', weight: 2,
        reason: '取引所からの大量BTCアウトフロー = ホドラーが保管に移している。売り圧力の構造的低下' })
    else if (netFlow > 100_000_000)
      signals.push({ label: '取引所流入', value: `+$${(netFlow/1e6).toFixed(0)}M`, verdict: 'bear', weight: 2,
        reason: '取引所へのBTC大量インフロー = 売却準備が増えている。売り圧力上昇のサイン' })
  }

  // ── DVOL ──────────────────────────────────────────────────
  const dvol = vol.dvol
  if (dvol != null) {
    if (dvol > 80)
      signals.push({ label: 'DVOL', value: dvol.toFixed(1), verdict: 'neutral', weight: 1,
        reason: `インプライドボラティリティ高水準(${dvol.toFixed(0)})。大きな価格変動が迫っている可能性。方向は不明` })
    else if (dvol < 40)
      signals.push({ label: 'DVOL', value: dvol.toFixed(1), verdict: 'neutral', weight: 1,
        reason: `ボラティリティ低水準(${dvol.toFixed(0)})。コイルドスプリング状態。近いうちに一方向への大きな動きが来やすい` })
  }

  // ── Coinbase Premium ──────────────────────────────────────
  const cbp = d.coinbase_premium_pct
  if (cbp != null) {
    if (cbp > 0.002)
      signals.push({ label: 'CB Premium', value: `+${(cbp * 100).toFixed(3)}%`, verdict: 'bull', weight: 1,
        reason: '米機関・リテール勢がCoinbaseでBinanceより高値で買っている。米国からの買い需要強い' })
    else if (cbp < -0.002)
      signals.push({ label: 'CB Premium', value: `${(cbp * 100).toFixed(3)}%`, verdict: 'bear', weight: 1,
        reason: 'Coinbaseでディスカウント取引。米国勢が売り側に傾いている' })
  }

  return signals
}

function AnalysisPanel({ d }: { d: any }) {
  const signals = buildSignals(d)
  const bullW = signals.filter(s => s.verdict === 'bull').reduce((a, s) => a + s.weight, 0)
  const bearW = signals.filter(s => s.verdict === 'bear').reduce((a, s) => a + s.weight, 0)
  const total = bullW + bearW || 1
  const bullPct = Math.round(bullW / total * 100)
  const bearPct = 100 - bullPct

  let bias: 'BULL' | 'BEAR' | 'NEUTRAL' = 'NEUTRAL'
  let biasColor = 'var(--btc)'
  if (bullW >= bearW + 3) { bias = 'BULL'; biasColor = 'var(--green)' }
  else if (bearW >= bullW + 3) { bias = 'BEAR'; biasColor = 'var(--red)' }

  const topBull = signals.filter(s => s.verdict === 'bull').sort((a, b) => b.weight - a.weight).slice(0, 2)
  const topBear = signals.filter(s => s.verdict === 'bear').sort((a, b) => b.weight - a.weight).slice(0, 2)

  return (
    <GlassCard style={{ padding: '20px 24px', marginBottom: 16 }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2, letterSpacing: '0.1em' }}>AI MARKET ANALYSIS</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: biasColor, textShadow: `0 0 24px ${biasColor}66`, letterSpacing: '0.05em' }}>
            {bias}
          </div>
        </div>
        {/* バー */}
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', gap: 1 }}>
            <div style={{ width: `${bullPct}%`, background: 'linear-gradient(90deg,#00FF88,#00FF8866)', transition: 'width 0.5s' }} />
            <div style={{ width: `${bearPct}%`, background: 'linear-gradient(90deg,#FF336666,#FF3366)', transition: 'width 0.5s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.7rem', fontFamily: 'var(--mono)' }}>
            <span style={{ color: 'var(--green)' }}>BULL {bullPct}%</span>
            <span style={{ color: 'var(--red)' }}>BEAR {bearPct}%</span>
          </div>
        </div>
      </div>

      {/* シグナル一覧 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 10 }}>
        {signals.map((s, i) => {
          const bg    = s.verdict === 'bull' ? 'rgba(0,255,136,0.06)' : s.verdict === 'bear' ? 'rgba(255,51,102,0.06)' : 'rgba(255,255,255,0.03)'
          const bd    = s.verdict === 'bull' ? 'rgba(0,255,136,0.2)' : s.verdict === 'bear' ? 'rgba(255,51,102,0.2)' : 'rgba(255,255,255,0.08)'
          const col   = s.verdict === 'bull' ? 'var(--green)' : s.verdict === 'bear' ? 'var(--red)' : 'var(--text-muted)'
          const icon  = s.verdict === 'bull' ? '▲' : s.verdict === 'bear' ? '▼' : '●'
          return (
            <div key={i} style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--sans)' }}>{s.label}</span>
                <span style={{ fontSize: '0.8rem', fontFamily: 'var(--mono)', fontWeight: 700, color: col }}>
                  {icon} {s.value}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>{s.reason}</div>
            </div>
          )
        })}
      </div>

      {/* 総合コメント */}
      {(topBull.length > 0 || topBear.length > 0) && (
        <div style={{ marginTop: 14, padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, borderLeft: `3px solid ${biasColor}` }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.08em' }}>SUMMARY</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.7 }}>
            {topBull.length > 0 && (
              <span style={{ color: 'var(--green)' }}>
                【強気材料】{topBull.map(s => s.reason).join('。')}{'. '}
              </span>
            )}
            {topBear.length > 0 && (
              <span style={{ color: 'var(--red)' }}>
                【弱気材料】{topBear.map(s => s.reason).join('。')}.
              </span>
            )}
          </div>
        </div>
      )}
    </GlassCard>
  )
}

// ============================================================
// タブコンテンツ
// ============================================================

function TabOverview({ d, tech }: { d: any; tech: any }) {
  const vol = d.vol || {}
  const etf = d.etf_flow || {}
  const ef  = d.exchange_flow || {}
  const fr  = d.fr_aggregate || {}
  const mem = d.mempool || {}
  const sig    = tech?.signal || 'NEUTRAL'
  const score  = tech?.composite_score || 0
  const isBull = sig === 'BULL'
  const isBear = sig === 'BEAR'
  const sigColor  = isBull ? 'var(--green)' : isBear ? 'var(--red)' : 'var(--btc)'
  const sigBg     = isBull ? 'rgba(0,255,136,0.05)' : isBear ? 'rgba(255,51,102,0.05)' : 'rgba(247,147,26,0.04)'
  const sigBorder = isBull ? 'rgba(0,255,136,0.25)' : isBear ? 'rgba(255,51,102,0.25)' : 'rgba(247,147,26,0.2)'
  const sigRGB    = isBull ? '0,255,136' : isBear ? '255,51,102' : '247,147,26'

  return (
    <div className="tab-content">
      {/* AI分析パネル */}
      <AnalysisPanel d={d} />

      {/* シグナルバナー */}
      <div style={{
        background: sigBg,
        border: `1px solid ${sigBorder}`,
        borderRadius: 16,
        padding: '16px 24px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        boxShadow: `0 0 40px ${sigBg}`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 1, top: 0,
          background: `linear-gradient(90deg,transparent,${sigColor},transparent)`,
          opacity: 0.4,
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            border: `1px solid ${sigBorder}`,
            background: `rgba(${sigRGB},0.1)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem', color: sigColor,
            boxShadow: `0 0 16px ${sigBg}`,
          }}>
            {isBull ? '▲' : isBear ? '▼' : '◆'}
          </div>
          <div>
            <div style={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>
              市場シグナル
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: sigColor, letterSpacing: '0.05em' }}>
              {sig}
            </div>
          </div>
          <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.08)' }} />
          <div>
            <div style={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>
              スコア
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>
              {score > 0 ? '+' : ''}{score.toFixed(1)}
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 2 }}>/3.0</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="live-dot" />
          <div style={{
            fontFamily: 'var(--mono)', fontWeight: 800,
            fontSize: 'clamp(1.4rem,4vw,2rem)',
            color: 'var(--btc)',
            textShadow: '0 0 30px rgba(247,147,26,0.5)',
            letterSpacing: '-0.02em',
          }}>
            {d.btc_price ? `$${fmtN(d.btc_price)}` : '—'}
          </div>
        </div>
      </div>

      {/* メトリクスグリッド */}
      <div className="grid-4" style={{ marginBottom: 12 }}>
        <MetricCard
          label="BTC ドミナンス"
          value={d.btc_dominance ? `${fmt(d.btc_dominance)}%` : '—'}
          color="btc"
        />
        <MetricCard
          label="DVOL ≈ BVX"
          value={fmt(vol.dvol, 1)}
          sub={`HV ${fmt(vol.realized_vol, 1)}  VRP ${vol.vrp != null ? (vol.vrp > 0 ? '+' : '') + fmt(vol.vrp, 1) : '—'}pt`}
          color={vol.vrp != null && vol.vrp > 8 ? 'red' : 'cyan'}
        />
        <MetricCard
          label="FR 平均 (BTC 12取引所)"
          value={fr.BTC?.avg != null ? fmtP(fr.BTC.avg) : '—'}
          sub={fr.BTC?.avg != null ? (fr.BTC.avg > 0 ? 'ロング偏重' : 'ショート偏重') : ''}
          color={fr.BTC?.avg != null ? (fr.BTC.avg > 0.0003 ? 'red' : fr.BTC.avg < -0.0003 ? 'cyan' : 'default') : 'default'}
        />
        <MetricCard
          label="CB Premium"
          value={fmtP(d.coinbase_premium_pct, 3)}
          color={d.coinbase_premium_pct != null ? (d.coinbase_premium_pct > 0 ? 'green' : 'red') : 'default'}
        />
      </div>

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <MetricCard
          label="Mempool TX数"
          value={fmtN(mem.count)}
          sub={`手数料 ${mem.fee_fast || '?'} sat/vB`}
        />
        <MetricCard
          label="P/C Ratio (Deribit)"
          value={fmt(vol.pc_ratio, 2)}
          sub={vol.pc_ratio != null ? (vol.pc_ratio > 1 ? 'プット優勢 (下落警戒)' : 'コール優勢 (上昇期待)') : ''}
          color={vol.pc_ratio != null ? (vol.pc_ratio > 1.5 ? 'red' : vol.pc_ratio < 0.8 ? 'green' : 'default') : 'default'}
        />
        <MetricCard
          label="ETF Flow (昨日)"
          value={etf.daily_total_musd != null ? `${etf.daily_total_musd > 0 ? '+' : ''}$${Math.abs(etf.daily_total_musd).toFixed(1)}M` : '—'}
          sub={etf.daily_total_musd != null ? (etf.daily_total_musd > 0 ? '機関流入' : '機関流出') : ''}
          color={etf.daily_total_musd != null ? (etf.daily_total_musd > 0 ? 'green' : 'red') : 'default'}
        />
        <MetricCard
          label="取引所 Flow (net)"
          value={ef.net_usd != null ? fmtM(ef.net_usd) : '—'}
          sub={ef.net_usd != null ? (ef.net_usd < 0 ? '引出超 (蓄積)' : '流入超 (売り圧)') : ''}
          color={ef.net_usd != null ? (ef.net_usd < 0 ? 'green' : 'red') : 'default'}
        />
      </div>

      {/* FR概要テーブル */}
      <SectionHeader title="Funding Rate 概要" sub="主要銘柄 · 12取引所平均" />
      <GlassCard style={{ padding: '4px 0', marginBottom: 16 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left', paddingLeft: 16 }}>銘柄</th>
              <th>平均 FR</th>
              <th>最大</th>
              <th>最小</th>
              <th>乖離幅</th>
              <th>取引所数</th>
            </tr>
          </thead>
          <tbody>
            {(['BTC', 'ETH', 'SOL', 'XRP', 'BNB'] as const).map(coin => {
              const a = fr[coin]
              if (!a) return null
              return (
                <tr key={coin}>
                  <td style={{ paddingLeft: 16, fontFamily: 'var(--sans)', fontWeight: 700 }}>{coin}</td>
                  <td className={frClass(a.avg)} style={{ fontWeight: 600 }}>{fmtP(a.avg)}</td>
                  <td style={{ color: 'var(--red)' }}>{fmtP(a.max)}</td>
                  <td style={{ color: 'var(--cyan)' }}>{fmtP(a.min)}</td>
                  <td style={{ color: 'var(--text-dim)' }}>{fmtP(a.spread)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{a.n_exchanges}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </GlassCard>
    </div>
  )
}

function TabFROI({ d }: { d: any }) {
  const fr  = d.funding_rates || {}
  const agg = d.fr_aggregate || {}
  const oi  = d.open_interest || {}
  const EXCHANGES = ['binance','bybit','okx','hyperliquid','gate','bitget','mexc','htx','dydx','bitmex','bingx','woox']

  return (
    <div className="tab-content">
      <SectionHeader title="Funding Rate ヒートマップ" sub="15銘柄 × 12取引所" />
      <GlassCard style={{ padding: '4px 0', marginBottom: 20, overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: 800 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', paddingLeft: 16, minWidth: 60 }}>銘柄</th>
              {EXCHANGES.map(e => <th key={e} style={{ minWidth: 72 }}>{e.slice(0, 7)}</th>)}
              <th style={{ minWidth: 72 }}>Avg</th>
              <th style={{ minWidth: 72 }}>Spread</th>
            </tr>
          </thead>
          <tbody>
            {TOP15.map(coin => {
              const coinFR = fr[coin] || {}
              const a = agg[coin] || {}
              return (
                <tr key={coin}>
                  <td style={{ paddingLeft: 16, fontFamily: 'var(--sans)', fontWeight: 700, color: 'var(--text)' }}>
                    {coin}
                  </td>
                  {EXCHANGES.map(ex => {
                    const v = coinFR[ex]
                    return (
                      <td key={ex} className={frClass(v)} style={{ fontWeight: 500 }}>
                        {v != null
                          ? (v * 100).toFixed(4)
                          : <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>—</span>
                        }
                      </td>
                    )
                  })}
                  <td className={frClass(a.avg)} style={{ fontWeight: 700 }}>
                    {a.avg != null ? (a.avg * 100).toFixed(4) : '—'}
                  </td>
                  <td style={{ color: 'var(--text-dim)' }}>
                    {a.spread != null ? (a.spread * 100).toFixed(4) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </GlassCard>

      <SectionHeader title="Open Interest" sub="BTC建て · 主要取引所" />
      <GlassCard style={{ padding: '4px 0', overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: 600 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', paddingLeft: 16 }}>銘柄</th>
              {OI_EXCHANGES.map(e => <th key={e}>{e}</th>)}
              <th>合計 (coin)</th>
            </tr>
          </thead>
          <tbody>
            {['BTC','ETH','SOL','XRP','BNB','DOGE','ADA','LINK','AVAX'].map(coin => {
              const coinOI = oi[coin] || {}
              const tot = d.oi_total?.[coin] || {}
              return (
                <tr key={coin}>
                  <td style={{ paddingLeft: 16, fontFamily: 'var(--sans)', fontWeight: 700 }}>{coin}</td>
                  {OI_EXCHANGES.map(ex => {
                    const v = coinOI[ex]?.oi_coin
                    return (
                      <td key={ex}>
                        {v != null ? fmtN(v) : <span style={{ opacity: 0.3 }}>—</span>}
                      </td>
                    )
                  })}
                  <td style={{ color: 'var(--btc)', fontWeight: 700 }}>
                    {tot.total_coin != null ? fmtN(tot.total_coin) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </GlassCard>
    </div>
  )
}

function TabVol({ d }: { d: any }) {
  const vol    = d.vol || {}
  const ts     = vol.term_structure || {}
  const tsDays = Object.keys(ts).map(Number).sort((a, b) => a - b)

  return (
    <div className="tab-content">
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <MetricCard
          label="DVOL (≈ BVX)"
          value={fmt(vol.dvol, 1)}
          color="btc"
          sub="Deribit 30D Implied Vol"
        />
        <MetricCard
          label="実現ボラ (HV)"
          value={fmt(vol.realized_vol, 1)}
          sub="Historical Volatility"
        />
        <MetricCard
          label="VRP (DVOL − HV)"
          value={vol.vrp != null ? `${vol.vrp > 0 ? '+' : ''}${fmt(vol.vrp, 1)}pt` : '—'}
          color={vol.vrp != null ? (vol.vrp > 8 ? 'red' : vol.vrp < 2 ? 'green' : 'default') : 'default'}
          sub={vol.vrp != null ? (vol.vrp > 8 ? 'IVが割高 (売り圧注意)' : vol.vrp < 2 ? 'IVが安い' : '標準') : ''}
        />
      </div>
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <MetricCard
          label="先物プレミアム"
          value={vol.futures_premium_pct != null ? `${(vol.futures_premium_pct * 100).toFixed(3)}%` : '—'}
          color={vol.futures_premium_pct != null ? (vol.futures_premium_pct > 0 ? 'green' : 'red') : 'default'}
          sub={vol.futures_premium_pct != null ? (vol.futures_premium_pct > 0 ? 'コンタンゴ (強気)' : 'バックワーデーション (弱気)') : ''}
        />
        <MetricCard
          label="P/C Ratio"
          value={fmt(vol.pc_ratio, 2)}
          color={vol.pc_ratio != null ? (vol.pc_ratio > 1.5 ? 'red' : vol.pc_ratio < 0.8 ? 'green' : 'default') : 'default'}
          sub={vol.pc_ratio != null ? (vol.pc_ratio > 1 ? 'プット優勢 (恐怖)' : 'コール優勢 (楽観)') : ''}
        />
        <MetricCard
          label="Risk Reversal 7DTE"
          value={vol.rr_7d != null ? `${fmt(vol.rr_7d, 2)} vol` : '—'}
          color={vol.rr_7d != null ? (vol.rr_7d < -3 ? 'red' : vol.rr_7d > 1 ? 'green' : 'default') : 'default'}
        />
      </div>

      {/* ターム構造 */}
      {tsDays.length > 0 && (
        <>
          <SectionHeader title="インプライドボラ ターム構造" />
          <GlassCard style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160, justifyContent: 'center' }}>
              {tsDays.map(dte => {
                const iv    = ts[dte.toString()] as number
                const maxIV = Math.max(...tsDays.map((d2: number) => (ts[d2.toString()] as number) || 0))
                const h     = iv ? (iv / maxIV * 120) : 20
                const col   = iv > 50 ? 'var(--red)' : iv > 40 ? 'var(--btc)' : 'var(--cyan)'
                return (
                  <div key={dte} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: col, fontWeight: 700 }}>
                      {iv?.toFixed(1)}
                    </div>
                    <div style={{
                      width: 36, height: h,
                      background: `linear-gradient(180deg,${col},${col}44)`,
                      borderRadius: '4px 4px 0 0',
                      boxShadow: `0 0 12px ${col}44`,
                    }} />
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{dte}D</div>
                  </div>
                )
              })}
            </div>
          </GlassCard>
        </>
      )}
    </div>
  )
}

function TabFlow({ d }: { d: any }) {
  const etf    = d.etf_flow || {}
  const ef     = d.exchange_flow || {}
  const sc     = d.stablecoins || {}
  const tickers        = etf.tickers || {}
  const tickerEntries  = Object.entries(tickers).filter(([k]) => k !== 'Total') as [string, number][]

  return (
    <div className="tab-content">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* ETF Flow */}
        <div>
          <SectionHeader title="ETF Custody Flow" sub="機関投資家フロー" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <GlassCard>
              <div className="metric-label">ネットフロー (昨日)</div>
              <div
                className={`metric-value text-mono ${etf.daily_total_musd != null ? (etf.daily_total_musd > 0 ? 'text-green' : 'text-red') : ''}`}
                style={{ fontSize: '1.6rem' }}
              >
                {etf.daily_total_musd != null
                  ? `${etf.daily_total_musd > 0 ? '+' : ''}$${Math.abs(etf.daily_total_musd).toFixed(1)}M`
                  : '—'}
              </div>
              <div className="metric-sub">{etf.latest_date || '—'}</div>
            </GlassCard>
            <MetricCard label="累積純資産" value={fmtB(etf.cumulative_usd)} color="btc" />
            {tickerEntries.length > 0 && (
              <GlassCard style={{ padding: '14px 18px' }}>
                <div className="metric-label" style={{ marginBottom: 10 }}>ETF別フロー ($M)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {tickerEntries
                    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                    .slice(0, 5)
                    .map(([k, v]) => {
                      const max = Math.max(...tickerEntries.map(([, x]) => Math.abs(x)), 1)
                      const w   = Math.abs(v) / max * 100
                      return (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ minWidth: 40, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)' }}>
                            {k}
                          </span>
                          <div style={{ flex: 1, height: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                            <div style={{
                              width: `${w}%`, height: '100%', borderRadius: 4,
                              background: v > 0
                                ? 'linear-gradient(90deg,rgba(0,255,136,0.3),rgba(0,255,136,0.15))'
                                : 'linear-gradient(90deg,rgba(255,51,102,0.3),rgba(255,51,102,0.15))',
                              boxShadow: v > 0
                                ? 'inset 0 0 8px rgba(0,255,136,0.2)'
                                : 'inset 0 0 8px rgba(255,51,102,0.2)',
                            }} />
                          </div>
                          <span style={{
                            minWidth: 56, fontSize: '0.72rem', fontFamily: 'var(--mono)',
                            color: v > 0 ? 'var(--green)' : 'var(--red)', textAlign: 'right',
                          }}>
                            {v > 0 ? '+' : ''}{v.toFixed(1)}
                          </span>
                        </div>
                      )
                    })}
                </div>
              </GlassCard>
            )}
          </div>
        </div>

        {/* Exchange Flow */}
        <div>
          <SectionHeader title="取引所 Flow (Coinmetrics)" sub="オンチェーン資金移動" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <GlassCard style={ef.net_usd != null ? (ef.net_usd < 0 ? { borderColor: 'rgba(0,255,136,0.3)' } : { borderColor: 'rgba(255,51,102,0.3)' }) : {}}>
              <div className="metric-label">Net Flow (取引所出入)</div>
              <div
                className={`metric-value text-mono ${ef.net_usd != null ? (ef.net_usd < 0 ? 'text-green' : 'text-red') : ''}`}
                style={{ fontSize: '1.6rem' }}
              >
                {ef.net_usd != null ? fmtM(ef.net_usd) : '—'}
              </div>
              <div className="metric-sub">
                {ef.net_usd != null ? (ef.net_usd < 0 ? '引出超 → BTC蓄積 (強気)' : '流入超 → 売り圧力 (弱気)') : ''}
              </div>
            </GlassCard>
            <div className="grid-2">
              <MetricCard label="流入 (Inflow)"  value={fmtM(ef.inflow_usd)}  color="red" />
              <MetricCard label="流出 (Outflow)" value={fmtM(ef.outflow_usd)} color="green" />
            </div>
            <MetricCard
              label="取引所 BTC 残高"
              value={ef.exchange_balance_btc != null ? `${(ef.exchange_balance_btc / 1000).toFixed(0)}K BTC` : '—'}
              color="btc"
            />
          </div>
        </div>
      </div>

      {/* Stablecoin */}
      <SectionHeader title="ステーブルコイン供給" sub="市場流動性指標" />
      <div className="grid-3">
        <MetricCard label="USDT 発行残高" value={fmtB(sc.usdt_usd)} />
        <MetricCard label="USDC 発行残高" value={fmtB(sc.usdc_usd)} />
        <MetricCard
          label="USD系 合計"
          value={fmtB(sc.total_usd)}
          sub={sc.weekly_change_pct != null ? `週次変化 ${sc.weekly_change_pct > 0 ? '+' : ''}${sc.weekly_change_pct.toFixed(2)}%` : ''}
          color={sc.weekly_change_pct != null ? (sc.weekly_change_pct > 0 ? 'green' : 'red') : 'default'}
        />
      </div>
    </div>
  )
}

function TabMacro({ d }: { d: any }) {
  const mac = d.macro || {}
  const items: { label: string; value: string; color: MetricColor }[] = [
    { label: 'S&P500 (SPY)',  value: mac.spy ? `$${mac.spy.toFixed(2)}` : '—',      color: 'default' },
    { label: 'Gold (GLD)',    value: mac.gld ? `$${mac.gld.toFixed(2)}` : '—',      color: 'default' },
    { label: '原油 (CL=F)',   value: mac.oil ? `$${mac.oil.toFixed(2)}` : '—',      color: 'default' },
    {
      label: '米 10年金利',
      value: mac.us10y ? `${mac.us10y.toFixed(3)}%` : '—',
      color: mac.us10y != null ? (mac.us10y > 4.5 ? 'red' : mac.us10y < 3.5 ? 'green' : 'default') : 'default',
    },
    { label: '米 2年金利',      value: mac.us02y ? `${mac.us02y.toFixed(3)}%` : '—', color: 'default' },
    {
      label: 'イールドスプレッド',
      value: mac.yield_spread != null ? `${mac.yield_spread > 0 ? '+' : ''}${mac.yield_spread.toFixed(3)}%` : '—',
      color: mac.yield_spread != null ? (mac.yield_spread < 0 ? 'red' : 'green') : 'default',
    },
  ]
  return (
    <div className="tab-content">
      <SectionHeader title="マクロ指標" sub="BTC相関市場" />
      <div className="grid-3">
        {items.map(i => (
          <MetricCard key={i.label} label={i.label} value={i.value} color={i.color} />
        ))}
      </div>
    </div>
  )
}

function TabHistory() {
  const [history, setHistory] = useState<any[]>([])
  const [period, setPeriod] = useState(24)
  const [metric, setMetric] = useState<'btc_price'|'dvol'|'fr_btc'|'mempool'>('btc_price')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/history?hours=${period}`)
      .then(r => r.json())
      .then(data => {
        setHistory(Array.isArray(data) ? data.reverse() : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [period])

  const points = history.map(row => {
    const ts = new Date(row.timestamp).getTime()
    let val: number|null = null
    if (metric === 'btc_price') val = row.btc_price
    else if (metric === 'dvol') val = row.vol?.dvol
    else if (metric === 'fr_btc') val = row.fr_aggregate?.BTC?.avg != null ? row.fr_aggregate.BTC.avg * 10000 : null
    else if (metric === 'mempool') val = row.mempool?.count ? row.mempool.count / 1000 : null
    return { ts, val }
  }).filter(p => p.val != null)

  const METRIC_LABELS: Record<string, string> = {
    btc_price: 'BTC価格 (USD)',
    dvol: 'DVOL',
    fr_btc: 'BTC FR × 10000',
    mempool: 'Mempool (K件)',
  }

  const renderChart = () => {
    if (points.length < 2) return (
      <div style={{color:'var(--text-muted)',textAlign:'center',padding:'40px 0'}}>
        データが不足しています（{period}H以内のデータ: {points.length}件）
      </div>
    )

    const vals = points.map(p => p.val as number)
    const minV = Math.min(...vals)
    const maxV = Math.max(...vals)
    const range = maxV - minV || 1

    const W = 800; const H = 200; const PAD = 40

    const toX = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2)
    const toY = (v: number) => H - PAD - ((v - minV) / range) * (H - PAD * 2)

    const pathD = points.map((p, i) => `${i===0?'M':'L'} ${toX(i)} ${toY(p.val!)}`).join(' ')
    const areaD = pathD + ` L ${toX(points.length-1)} ${H-PAD} L ${toX(0)} ${H-PAD} Z`

    const color = metric === 'btc_price' ? 'var(--btc)' : metric === 'dvol' ? 'var(--cyan)' : metric === 'fr_btc' ? 'var(--green)' : 'var(--text-muted)'
    const colorRGB = metric === 'btc_price' ? '247,147,26' : metric === 'dvol' ? '0,212,255' : '0,255,136'

    const firstDate = new Date(points[0].ts)
    const lastDate  = new Date(points[points.length-1].ts)
    const fmt2 = (d:Date) => `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`

    return (
      <div style={{overflowX:'auto'}}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto',minWidth:300}}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#areaGrad)" />
          <path d={pathD} fill="none" stroke={color} strokeWidth="1.5"
            style={{filter:`drop-shadow(0 0 4px rgba(${colorRGB},0.6))`}} />
          <line x1={PAD} y1={toY(maxV)} x2={W-PAD} y2={toY(maxV)} stroke="rgba(255,255,255,0.05)" strokeDasharray="4,4" />
          <line x1={PAD} y1={toY(minV)} x2={W-PAD} y2={toY(minV)} stroke="rgba(255,255,255,0.05)" strokeDasharray="4,4" />
          <text x={W-PAD+4} y={toY(maxV)+4} fill="rgba(255,255,255,0.5)" fontSize="9" fontFamily="monospace">{metric==='btc_price'?`$${Math.round(maxV).toLocaleString()}`:maxV.toFixed(2)}</text>
          <text x={W-PAD+4} y={toY(minV)+4} fill="rgba(255,255,255,0.5)" fontSize="9" fontFamily="monospace">{metric==='btc_price'?`$${Math.round(minV).toLocaleString()}`:minV.toFixed(2)}</text>
          <text x={PAD} y={H-4} fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace">{fmt2(firstDate)}</text>
          <text x={W-PAD} y={H-4} fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace" textAnchor="end">{fmt2(lastDate)}</text>
        </svg>
      </div>
    )
  }

  return (
    <div className="tab-content">
      <SectionHeader title="履歴チャート" sub="Supabase スナップショット" />

      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
        <div style={{display:'flex',gap:4}}>
          {[{h:1,l:'1H'},{h:6,l:'6H'},{h:24,l:'24H'},{h:168,l:'7D'}].map(({h,l})=>(
            <button key={h} onClick={()=>setPeriod(h)}
              className={`tab-btn ${period===h?'active':''}`}
              style={{padding:'6px 12px',fontSize:'0.72rem'}}>
              {l}
            </button>
          ))}
        </div>
        <div style={{display:'flex',gap:4}}>
          {([
            ['btc_price','BTC価格'],['dvol','DVOL'],
            ['fr_btc','BTC FR'],['mempool','Mempool'],
          ] as [string,string][]).map(([k,l])=>(
            <button key={k} onClick={()=>setMetric(k as 'btc_price'|'dvol'|'fr_btc'|'mempool')}
              className={`tab-btn ${metric===k?'active':''}`}
              style={{padding:'6px 12px',fontSize:'0.72rem'}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <GlassCard style={{padding:'20px',marginBottom:16}}>
        <div style={{marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontFamily:'var(--mono)',fontSize:'0.75rem',color:'var(--text-muted)',letterSpacing:'0.1em',textTransform:'uppercase'}}>
            {METRIC_LABELS[metric]} — 直近{period >= 168 ? '7D' : period >= 24 ? '24H' : `${period}H`}
          </div>
          <div style={{fontSize:'0.7rem',color:'var(--text-muted)'}}>
            {loading ? '読込中...' : `${points.length}件のスナップショット`}
          </div>
        </div>
        {renderChart()}
      </GlassCard>

      {points.length >= 2 && (() => {
        const vals = points.map(p => p.val as number)
        const latest = vals[vals.length-1]
        const oldest = vals[0]
        const chgPct = ((latest - oldest) / oldest * 100)
        const max = Math.max(...vals)
        const min = Math.min(...vals)
        const fmtV = (v: number) => metric==='btc_price' ? `$${Math.round(v).toLocaleString()}` : v.toFixed(3)
        return (
          <div className="grid-4">
            <MetricCard label="最新値" value={fmtV(latest)} color="btc" />
            <MetricCard label={`${period>=168?'7D':period>=24?'24H':`${period}H`}変化`}
              value={`${chgPct>=0?'+':''}${chgPct.toFixed(2)}%`}
              color={chgPct>=0?'green':'red'} />
            <MetricCard label="期間最高値" value={fmtV(max)} />
            <MetricCard label="期間最安値" value={fmtV(min)} />
          </div>
        )
      })()}
    </div>
  )
}

function TabLiq({ d }: { d: any }) {
  const liq   = d.liquidations || {}
  const taker = liq.bn_taker_ls || {}
  const acct  = liq.bn_account_ls || {}
  const coins = ['BTC','ETH','SOL','XRP','BNB','DOGE','ADA','LINK','AVAX','DOT','LTC','UNI']

  return (
    <div className="tab-content">
      {/* 主要取引所 清算サマリー */}
      {(() => {
        const totalLong  = (liq.okx_long_liq_btc  || 0) + (liq.binance_long_liq_btc  || 0) + (liq.bybit_long_liq_btc  || 0) + (liq.bitmex_long_liq_btc  || 0)
        const totalShort = (liq.okx_short_liq_btc || 0) + (liq.binance_short_liq_btc || 0) + (liq.bybit_short_liq_btc || 0) + (liq.bitmex_short_liq_btc || 0)
        const dir = totalShort > totalLong ? 'SHORT SQUEEZE' : 'LONG SQUEEZE'
        return (
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <MetricCard label="合計ロング清算" value={`${fmtN(totalLong)} BTC`} color="red" />
            <MetricCard label="合計ショート清算" value={`${fmtN(totalShort)} BTC`} color="green" />
            <MetricCard label="BitMEX 清算件数" value={liq.bitmex_liq_count_1h != null ? `${liq.bitmex_liq_count_1h} 件` : '—'} />
            <MetricCard label="清算方向" value={dir} color={totalShort > totalLong ? 'green' : 'red'} />
          </div>
        )
      })()}

      {/* 取引所別清算テーブル */}
      <SectionHeader title="主要取引所 清算サマリー" sub="直近リアルタイム" />
      <GlassCard style={{ padding: '4px 0', marginBottom: 16, overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left', paddingLeft: 16 }}>取引所</th>
              <th>ロング清算 (BTC)</th>
              <th>ショート清算 (BTC)</th>
              <th>Net</th>
              <th>優勢</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'Binance', long: liq.binance_long_liq_btc, short: liq.binance_short_liq_btc },
              { name: 'Bybit',   long: liq.bybit_long_liq_btc,   short: liq.bybit_short_liq_btc   },
              { name: 'OKX',     long: liq.okx_long_liq_btc,     short: liq.okx_short_liq_btc     },
              { name: 'BitMEX',  long: liq.bitmex_long_liq_btc,  short: liq.bitmex_short_liq_btc  },
            ].map(({ name, long: l, short: s }) => {
              const net = (s || 0) - (l || 0)
              const dom = (s || 0) > (l || 0) ? 'SHORT↑' : 'LONG↓'
              return (
                <tr key={name}>
                  <td style={{ paddingLeft: 16, fontWeight: 700, color: 'var(--btc)' }}>{name}</td>
                  <td style={{ color: 'var(--red)',   fontFamily: 'var(--mono)', fontWeight: 600 }}>{l != null ? fmtN(l) : '—'}</td>
                  <td style={{ color: 'var(--green)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{s != null ? fmtN(s) : '—'}</td>
                  <td style={{ color: net > 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--mono)' }}>
                    {net > 0 ? '+' : ''}{fmtN(net)}
                  </td>
                  <td><Badge label={dom} type={(s || 0) > (l || 0) ? 'green' : 'red'} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </GlassCard>

      <SectionHeader title="Taker Buy/Sell 比率" sub="Binance · 1H" />
      <GlassCard style={{ padding: '4px 0', marginBottom: 16, overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left', paddingLeft: 16 }}>銘柄</th>
              <th>Buy出来高</th>
              <th>Sell出来高</th>
              <th>Buy/Sell比</th>
              <th>方向</th>
            </tr>
          </thead>
          <tbody>
            {coins.map(coin => {
              const t = taker[coin]
              if (!t) return null
              const isBuy = (t.ratio || 0) >= 1
              return (
                <tr key={coin}>
                  <td style={{ paddingLeft: 16, fontFamily: 'var(--sans)', fontWeight: 700 }}>{coin}</td>
                  <td>{fmtN(t.buy_vol)}</td>
                  <td>{fmtN(t.sell_vol)}</td>
                  <td style={{ color: isBuy ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                    {t.ratio?.toFixed(4)}
                  </td>
                  <td><Badge label={isBuy ? '買超' : '売超'} type={isBuy ? 'green' : 'red'} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </GlassCard>

      <SectionHeader title="アカウント L/S 比率" sub="Binance" />
      <GlassCard style={{ padding: '4px 0', overflowX: 'auto', marginBottom: 16 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left', paddingLeft: 16 }}>銘柄</th>
              <th>Long %</th>
              <th>Short %</th>
              <th>L/S比</th>
            </tr>
          </thead>
          <tbody>
            {coins.map(coin => {
              const a = acct[coin]
              if (!a) return null
              return (
                <tr key={coin}>
                  <td style={{ paddingLeft: 16, fontFamily: 'var(--sans)', fontWeight: 700 }}>{coin}</td>
                  <td style={{ color: 'var(--green)' }}>{(a.long * 100).toFixed(1)}%</td>
                  <td style={{ color: 'var(--red)' }}>{(a.short * 100).toFixed(1)}%</td>
                  <td style={{ color: a.ratio >= 1 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                    {a.ratio?.toFixed(3)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </GlassCard>

      <SectionHeader title="上位トレーダー ポジション L/S" sub="Binance · 大口建玉" />
      <GlassCard style={{ padding: '4px 0', overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left', paddingLeft: 16 }}>銘柄</th>
              <th>Long %</th>
              <th>Short %</th>
              <th>L/S比</th>
              <th>ポジション</th>
            </tr>
          </thead>
          <tbody>
            {coins.map(coin => {
              const t = liq.bn_top_ls?.[coin]
              if (!t) return null
              return (
                <tr key={coin}>
                  <td style={{ paddingLeft: 16, fontFamily: 'var(--sans)', fontWeight: 700 }}>{coin}</td>
                  <td style={{ color: 'var(--green)' }}>{(t.long * 100).toFixed(1)}%</td>
                  <td style={{ color: 'var(--red)' }}>{(t.short * 100).toFixed(1)}%</td>
                  <td style={{ color: t.ratio >= 1 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                    {t.ratio?.toFixed(3)}
                  </td>
                  <td>
                    <Badge label={t.ratio >= 1 ? 'Long優位' : 'Short優位'} type={t.ratio >= 1 ? 'green' : 'red'} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </GlassCard>
    </div>
  )
}

// ---- candle chart helpers ----
type Candle = { t: number; o: number; h: number; l: number; c: number }

function calcSMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) =>
    i < period - 1 ? null : closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
  )
}

// DISPLAY_COUNT: 表示する足数（SMA200ウォームアップ後の分）
const DISPLAY_COUNT: Record<string, number> = { '1h': 120, '4h': 100, '1d': 150, '1w': 80 }

function CandleChart({ candles, tf }: { candles: Candle[]; tf: string }) {
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
  )
}

function TabTech({ d }: { d: any }) {
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

  return (
    <div className="tab-content">
      {/* 総合 */}
      <GlassCard style={{ marginBottom: 16, padding: '16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div className="metric-label">総合シグナル</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: sigColor, textShadow: `0 0 20px ${sigColor}88` }}>
              {sig}
            </div>
          </div>
          <div>
            <div className="metric-label">スコア</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)' }}>
              {score > 0 ? '+' : ''}{score.toFixed(1)}/3.0
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {TFs.map(tf => {
              const t  = tech[tf] || {}
              const ts = t.trend_score || 0
              return (
                <div key={tf} style={{
                  padding: '8px 16px', borderRadius: 10,
                  background: ts > 0 ? 'rgba(0,255,136,0.08)' : ts < 0 ? 'rgba(255,51,102,0.08)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${ts > 0 ? 'rgba(0,255,136,0.2)' : ts < 0 ? 'rgba(255,51,102,0.2)' : 'rgba(255,255,255,0.08)'}`,
                  textAlign: 'center', minWidth: 72,
                }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2 }}>
                    {TFLabels[tf]}
                  </div>
                  <div style={{
                    fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '1rem',
                    color: ts > 0 ? 'var(--green)' : ts < 0 ? 'var(--red)' : 'var(--text-dim)',
                  }}>
                    {ts > 0 ? '+' : ''}{ts}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </GlassCard>

      {/* ローソク足チャート */}
      <SectionHeader title="BTC/USDT チャート" sub="SMA20 (水) · SMA75 (橙) · SMA200 (赤)" />
      <GlassCard style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
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
      </GlassCard>

      {/* SMAテーブル */}
      <SectionHeader title="SMA / RSI" sub="1H · 4H · 日足 · 週足" />
      <GlassCard style={{ padding: '4px 0', overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left', paddingLeft: 16 }}>時間足</th>
              <th>現在価格</th>
              <th>SMA 20</th>
              <th>SMA 75</th>
              <th>SMA 200</th>
              <th>RSI 14</th>
              <th>トレンド</th>
            </tr>
          </thead>
          <tbody>
            {TFs.map(tf => {
              const t = tech[tf] || {}
              return (
                <tr key={tf}>
                  <td style={{ paddingLeft: 16, fontFamily: 'var(--sans)', fontWeight: 700, color: 'var(--btc)' }}>
                    {TFLabels[tf]}
                  </td>
                  <td style={{ color: 'var(--text)', fontWeight: 700 }}>
                    {t.price ? `$${fmtN(t.price)}` : '—'}
                  </td>
                  {(['sma20', 'sma75', 'sma200'] as const).map(s => {
                    const vsKey = `vs_${s}`
                    const vs    = t[vsKey]
                    const smaV  = t[s]
                    return (
                      <td key={s} style={{
                        color: vs === 'above' ? 'var(--green)' : vs === 'below' ? 'var(--red)' : 'var(--text-dim)',
                      }}>
                        {smaV ? `$${fmtN(smaV)}` : '—'}
                        {vs === 'above' ? ' ✓' : vs === 'below' ? ' ✗' : ''}
                      </td>
                    )
                  })}
                  <td style={{ color: t.rsi14 > 70 ? 'var(--red)' : t.rsi14 < 30 ? 'var(--green)' : 'var(--text)' }}>
                    {t.rsi14 ? t.rsi14.toFixed(1) : '—'}
                  </td>
                  <td>
                    {t.trend_score != null
                      ? <Badge
                          label={`${t.trend_score > 0 ? '▲' : '▼'} ${Math.abs(t.trend_score)}`}
                          type={t.trend_score > 0 ? 'green' : t.trend_score < 0 ? 'red' : 'muted'}
                        />
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </GlassCard>
    </div>
  )
}

const EXCHANGE_COLORS: Record<string, string> = {
  okx:     '#00D4FF',
  binance: '#F7931A',
  bybit:   '#9B59B6',
  bitmex:  '#FF6B35',
}

function LiqMapChart({ lh, price }: { lh: any; price: number }) {
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
  )
}

function TabLiqMap({ d }: { d: any }) {
  const lh    = d.liq_heatmap || {}
  const kl    = lh.key_levels || {}
  const price = d.btc_price || 80000

  return (
    <div className="tab-content">
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <MetricCard
          label="ロング最大清算↓"
          value={kl.major_long_liq_below ? `$${kl.major_long_liq_below.toLocaleString()}` : '—'}
          sub={kl.major_long_liq_below ? `現在から -$${((price - kl.major_long_liq_below) / 1000).toFixed(0)}K` : ''}
          color="red"
        />
        <MetricCard
          label="ロング次点↓"
          value={kl.next_long_liq ? `$${kl.next_long_liq.toLocaleString()}` : '—'}
          sub={kl.next_long_liq ? `現在から -$${((price - kl.next_long_liq) / 1000).toFixed(0)}K` : ''}
          color="red"
        />
        <MetricCard
          label="ショート次点↑"
          value={kl.next_short_liq ? `$${kl.next_short_liq.toLocaleString()}` : '—'}
          sub={kl.next_short_liq ? `現在から +$${((kl.next_short_liq - price) / 1000).toFixed(0)}K` : ''}
          color="green"
        />
        <MetricCard
          label="ショート最大清算↑"
          value={kl.major_short_liq_above ? `$${kl.major_short_liq_above.toLocaleString()}` : '—'}
          sub={kl.major_short_liq_above ? `現在から +$${((kl.major_short_liq_above - price) / 1000).toFixed(0)}K` : ''}
          color="green"
        />
      </div>

      <SectionHeader title="清算水準マップ" sub="ローソク足 + 清算水準ライン + 実清算イベント" />
      <GlassCard style={{ padding: '16px 20px' }}>
        <LiqMapChart lh={lh} price={price} />
      </GlassCard>

      {(() => {
        const allEvts: any[] = lh.all_exchange_liq || []
        const sortedEvts = [...allEvts].sort((a, b) => (b.time_ms || 0) - (a.time_ms || 0)).slice(0, 20)
        if (!sortedEvts.length) return null
        return (
          <>
            <SectionHeader title="直近清算イベント" sub="Binance · Bybit · OKX · BitMEX" />
            <GlassCard style={{ padding: '4px 0', overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', paddingLeft: 16 }}>時刻 (JST)</th>
                    <th>取引所</th>
                    <th>サイド</th>
                    <th>清算価格</th>
                    <th>サイズ (BTC)</th>
                    <th>推定USD</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEvts.map((ev: any, i: number) => {
                    const isLong  = ev.side === 'long'
                    const exColor = EXCHANGE_COLORS[ev.exchange || 'okx'] || '#888'
                    const tsMs    = ev.time_ms
                    let timeStr   = '—'
                    if (tsMs) {
                      const jst = new Date(tsMs + 9 * 3600 * 1000)
                      timeStr = `${jst.getMonth()+1}/${jst.getDate()} ${jst.getHours()}:${String(jst.getMinutes()).padStart(2,'0')}`
                    }
                    return (
                      <tr key={i}>
                        <td style={{ paddingLeft: 16, fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {timeStr}
                        </td>
                        <td style={{ color: exColor, fontWeight: 700, fontSize: '0.8rem' }}>
                          {(ev.exchange || 'OKX').toUpperCase()}
                        </td>
                        <td>
                          <Badge label={isLong ? 'ロング清算' : 'ショート清算'} type={isLong ? 'red' : 'green'} />
                        </td>
                        <td style={{ color: 'var(--btc)', fontFamily: 'var(--mono)' }}>
                          ${ev.price?.toLocaleString()}
                        </td>
                        <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>
                          {ev.size_btc?.toFixed(4)}
                        </td>
                        <td style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
                          {ev.price && ev.size_btc ? `$${(ev.price * ev.size_btc / 1000).toFixed(1)}K` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </GlassCard>
          </>
        )
      })()}
    </div>
  )
}

function TabChanges({ d }: { d: any }) {
  const ch = d.changes || {}
  const rows: { key: string; label: string; fmtFn: (v: number) => string }[] = [
    { key: 'btc_price',           label: 'BTC価格',          fmtFn: (v) => `$${fmtN(v)}` },
    { key: 'btc_dominance',       label: 'BTCドミナンス',    fmtFn: (v) => `${fmt(v)}%` },
    { key: 'dvol',                label: 'DVOL',             fmtFn: (v) => fmt(v, 1) },
    { key: 'fr_avg_btc',          label: 'BTC FR平均',       fmtFn: (v) => fmtP(v) },
    { key: 'etf_daily',           label: 'ETF Flow (日次)',  fmtFn: (v) => fmtM(v) },
    { key: 'exchange_flow_net',   label: '取引所Flow net',   fmtFn: (v) => fmtM(v) },
    { key: 'stablecoin_total',    label: 'SC供給合計',       fmtFn: (v) => fmtB(v) },
    { key: 'mempool_count',       label: 'Mempool TX',       fmtFn: (v) => fmtN(v) },
    { key: 'oi_total_btc',        label: 'BTC OI合計',       fmtFn: (v) => `${fmtN(v)} BTC` },
    { key: 'coinbase_premium',    label: 'CB Premium',       fmtFn: (v) => fmtP(v, 3) },
  ]
  const chgColor = (v: number | null | undefined) =>
    v == null ? 'var(--text-muted)' : v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--text-dim)'
  const chgFmt = (v: number | null | undefined) =>
    v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`

  return (
    <div className="tab-content">
      <SectionHeader title="変化率" sub="前日 / 前週 / 前月" />
      <GlassCard style={{ padding: '4px 0', overflowX: 'auto', marginBottom: 16 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left', paddingLeft: 16 }}>データ</th>
              <th>現在値</th>
              <th>前日比</th>
              <th>前週比</th>
              <th>前月比</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, label, fmtFn }) => {
              const c = ch[key] || {}
              return (
                <tr key={key}>
                  <td style={{ paddingLeft: 16, fontFamily: 'var(--sans)', fontWeight: 500 }}>{label}</td>
                  <td style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                    {c.now != null ? fmtFn(c.now) : '—'}
                  </td>
                  <td style={{ color: chgColor(c.chg_24h), fontWeight: 600 }}>{chgFmt(c.chg_24h)}</td>
                  <td style={{ color: chgColor(c.chg_7d),  fontWeight: 600 }}>{chgFmt(c.chg_7d)}</td>
                  <td style={{ color: chgColor(c.chg_30d), fontWeight: 600 }}>{chgFmt(c.chg_30d)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </GlassCard>

      <SectionHeader title="前日比 横棒チャート" sub="正値=緑 / 負値=赤" />
      <GlassCard style={{ padding: '20px 24px' }}>
        {rows.map(({ key, label }) => {
          const c = ch[key] || {}
          const v = c.chg_24h
          if (v == null) return null
          const absMax = 20
          const w = Math.min(Math.abs(v) / absMax * 100, 100)
          const isPos = v >= 0
          const color = isPos ? 'var(--green)' : 'var(--red)'
          const colorRGB = isPos ? '0,255,136' : '255,51,102'
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ minWidth: 120, fontSize: '0.72rem', color: 'var(--text-dim)' }}>{label}</div>
              <div style={{
                flex: 1, height: 20,
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 4, overflow: 'hidden',
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.1)' }} />
                <div style={{
                  position: 'absolute',
                  ...(isPos ? { left: '50%' } : { right: '50%' }),
                  width: `${w / 2}%`,
                  height: '100%',
                  background: `linear-gradient(${isPos ? '90deg' : '270deg'},${color}66,${color}22)`,
                  boxShadow: `inset 0 0 8px rgba(${colorRGB},0.2)`,
                  borderRadius: isPos ? '0 4px 4px 0' : '4px 0 0 4px',
                }} />
              </div>
              <div style={{
                minWidth: 60,
                fontFamily: 'var(--mono)',
                fontSize: '0.75rem',
                color,
                textAlign: 'right',
                fontWeight: 600,
              }}>
                {v > 0 ? '+' : ''}{v.toFixed(2)}%
              </div>
            </div>
          )
        })}
      </GlassCard>
    </div>
  )
}

// ============================================================
// メインページ
// ============================================================

export default function Page() {
  const [data, setData]           = useState<any>(null)
  const [tab, setTab]             = useState(0)
  const [lastUpdate, setLastUpdate] = useState('')
  const [loading, setLoading]     = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const d = await fetchLatest()
    setData(d)
    setLastUpdate(new Date().toLocaleTimeString('ja-JP'))
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 60000)
    return () => clearInterval(t)
  }, [refresh])

  const d    = data || {}
  const tech = d.technical || {}

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 12px 40px', minHeight: '100vh' }}>

      {/* ===== ヘッダー ===== */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        marginBottom: 12,
        borderBottom: '1px solid rgba(247,147,26,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #F7931A, #F5A623)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: '1rem', color: '#000',
            boxShadow: '0 0 16px rgba(247,147,26,0.5)',
          }}>
            ₿
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--text)' }}>
              BTC <span style={{ color: 'var(--btc)' }}>NEXUS</span>
            </div>
            <div style={{ fontSize: '0.6rem', letterSpacing: '0.15em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Market Intelligence
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {d.btc_price && (
            <div style={{
              fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '1.1rem',
              color: 'var(--btc)', textShadow: '0 0 16px rgba(247,147,26,0.4)',
            }}>
              ${fmtN(d.btc_price)}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {loading ? (
              <>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--btc)', animation: 'pulse-btc 1s infinite' }} />
                更新中
              </>
            ) : (
              <>
                <div className="live-dot" />
                {lastUpdate}
              </>
            )}
          </div>
          <button
            onClick={refresh}
            style={{
              background: 'rgba(247,147,26,0.1)',
              border: '1px solid rgba(247,147,26,0.3)',
              color: 'var(--btc)', borderRadius: 8,
              padding: '5px 10px', cursor: 'pointer',
              fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.2s',
            }}
            onMouseOver={e => (e.currentTarget.style.background = 'rgba(247,147,26,0.2)')}
            onMouseOut={e  => (e.currentTarget.style.background = 'rgba(247,147,26,0.1)')}
          >
            ↻ 更新
          </button>
        </div>
      </header>

      {/* ===== タブバー ===== */}
      <nav className="tab-bar">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            className={`tab-btn ${tab === i ? 'active' : ''}`}
            onClick={() => setTab(i)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </nav>

      {/* ===== コンテンツ ===== */}
      {tab === 0 && <TabOverview  d={d} tech={tech} />}
      {tab === 1 && <TabFROI      d={d} />}
      {tab === 2 && <TabVol       d={d} />}
      {tab === 3 && <TabFlow      d={d} />}
      {tab === 4 && <TabMacro     d={d} />}
      {tab === 5 && <TabHistory   />}
      {tab === 6 && <TabLiq       d={d} />}
      {tab === 7 && <TabTech      d={d} />}
      {tab === 8 && <TabLiqMap    d={d} />}
      {tab === 9 && <TabChanges   d={d} />}
    </div>
  )
}
