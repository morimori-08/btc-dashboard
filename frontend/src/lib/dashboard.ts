// ============================================================
// Shared dashboard logic (extracted verbatim from the former page.tsx monolith).
// Types are intentionally permissive (`any` snapshot) — the live snapshot is a
// loosely-shaped JSON blob from /api/latest and the original code treated it as such.
// Formatters / buildSignals / buildNarrative are moved with identical logic + output.
// ============================================================

// ------------------------------------------------------------
// 定数
// ------------------------------------------------------------

export const TABS = [
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
  { id: 'ai_trade',   label: 'AIトレード', icon: '◎' },
]

export const TOP15 = ['BTC','ETH','XRP','BNB','SOL','TRX','DOGE','HYPE','ADA','LINK','TON','LTC','AVAX','DOT','UNI']
export const OI_EXCHANGES = ['binance','bybit','okx','hyperliquid','gate']

// ------------------------------------------------------------
// ユーティリティ
// ------------------------------------------------------------

export const fmt  = (v: number | null | undefined, d = 2): string =>
  v == null ? '—' : v.toFixed(d)

export const fmtP = (v: number | null | undefined, d = 4): string =>
  v == null ? '—' : `${(v * 100) >= 0 ? '+' : ''}${(v * 100).toFixed(d)}%`

export const fmtM = (v: number | null | undefined): string =>
  v == null ? '—' : `$${(v / 1e6).toFixed(0)}M`

export const fmtB = (v: number | null | undefined): string =>
  v == null ? '—' : `$${(v / 1e9).toFixed(1)}B`

export const fmtN = (v: number | null | undefined): string =>
  v == null ? '—' : v.toLocaleString(undefined, { maximumFractionDigits: 0 })

export function frClass(v: number | null | undefined): string {
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

// ------------------------------------------------------------
// AI分析エンジン v2 — 全タブ対応
// ------------------------------------------------------------

export type Signal = {
  label: string
  value: string
  verdict: 'bull' | 'bear' | 'neutral'
  weight: number   // 1=低, 2=中, 3=高
  reason: string   // 「なぜそうなのか・価格への影響」
  cat: 'tech' | 'position' | 'flow' | 'liq' | 'macro' | 'momentum'
}

export const CAT_META: Record<string, { label: string; icon: string }> = {
  tech:     { label: 'テクニカル',       icon: '◈' },
  position: { label: 'ポジション / FR',  icon: '◉' },
  flow:     { label: 'フロー',          icon: '◭' },
  liq:      { label: '清算',            icon: '◤' },
  macro:    { label: 'マクロ',          icon: '◍' },
  momentum: { label: 'モメンタム',      icon: '◬' },
}

export function buildSignals(d: any): Signal[] {
  const sigs: Signal[] = []
  const push = (s: Signal) => sigs.push(s)

  const fr   = d.fr_aggregate  || {}
  const liq  = d.liquidations  || {}
  const vol  = d.vol           || {}
  const etf  = d.etf_flow      || {}
  const ef   = d.exchange_flow || {}
  const tech = d.technical     || {}
  const lh   = d.liq_heatmap   || {}
  const mac  = d.macro         || {}
  const sc   = d.stablecoins   || {}
  const chg  = d.changes       || {}
  const kl   = lh.key_levels   || {}
  const price = d.btc_price    || 0

  // ════════════════════════════════════════
  // テクニカル (tech)
  // ════════════════════════════════════════

  // 複合テクニカルスコア（collector計算済み）
  const compScore = tech.composite_score
  const techSig   = tech.signal
  if (compScore != null) {
    if (compScore >= 2)
      push({ cat:'tech', label:'複合テクニカル', value:`+${compScore.toFixed(1)} BULL`, verdict:'bull', weight:3,
        reason:`4時間足まで含む全時間軸でSMA・RSIが強気配列。トレンド方向に乗るのが有利な局面` })
    else if (compScore <= -2)
      push({ cat:'tech', label:'複合テクニカル', value:`${compScore.toFixed(1)} BEAR`, verdict:'bear', weight:3,
        reason:`全時間軸で弱気配列。反発狙いより下落継続に備えるべき局面` })
    else if (compScore > 0)
      push({ cat:'tech', label:'複合テクニカル', value:`+${compScore.toFixed(1)}`, verdict:'neutral', weight:1,
        reason:`弱い強気バイアス。明確なトレンドは未形成。方向感を見極めながら対応` })
    else if (compScore < 0)
      push({ cat:'tech', label:'複合テクニカル', value:`${compScore.toFixed(1)}`, verdict:'neutral', weight:1,
        reason:`弱い弱気バイアス。下値不安が残るが売り込み過ぎには注意` })
  }

  // 多時間軸SMA配列 (1H/4H/1D/1W)
  const tfs = ['1h','4h','1d','1w'] as const
  const above200 = tfs.filter(tf => tech[tf]?.vs_sma200 === 'above').length
  const below200 = tfs.filter(tf => tech[tf]?.vs_sma200 === 'below').length
  if (above200 >= 3)
    push({ cat:'tech', label:'SMA200配列', value:`${above200}/4時間足が上方`, verdict:'bull', weight:2,
      reason:`複数時間軸でSMA200を上回り長期強気トレンドが継続。下落は押し目買いが入りやすい` })
  else if (below200 >= 3)
    push({ cat:'tech', label:'SMA200配列', value:`${below200}/4時間足が下方`, verdict:'bear', weight:2,
      reason:`複数時間軸でSMA200を下回り下降トレンド継続。反発は戻り売りに抑えられやすい` })

  // RSI マルチTF（過買い/過売り判定）
  const rsiVals = tfs.map(tf => ({ tf, rsi: tech[tf]?.rsi14 })).filter(x => x.rsi != null)
  const overbought  = rsiVals.filter(x => x.rsi > 70)
  const oversold    = rsiVals.filter(x => x.rsi < 30)
  if (overbought.length >= 2)
    push({ cat:'tech', label:'RSI過買い', value:`${overbought.map(x=>x.tf).join('/')} >70`, verdict:'bear', weight:2,
      reason:`${overbought.length}時間足でRSI過買い圏。エネルギー消耗→調整リスク。新規ロングは危険ゾーン` })
  else if (oversold.length >= 2)
    push({ cat:'tech', label:'RSI過売り', value:`${oversold.map(x=>x.tf).join('/')} <30`, verdict:'bull', weight:2,
      reason:`${oversold.length}時間足でRSI過売り圏。下げ過ぎからの反発が期待できる。ショートカバー注意` })
  else {
    const h1rsi = tech['1h']?.rsi14
    if (h1rsi != null && h1rsi > 70)
      push({ cat:'tech', label:'RSI(1H)', value:h1rsi.toFixed(1), verdict:'bear', weight:1,
        reason:`1H RSI過買い(${h1rsi.toFixed(0)})。短期的な調整が入りやすい。利確タイミングに注意` })
    else if (h1rsi != null && h1rsi < 30)
      push({ cat:'tech', label:'RSI(1H)', value:h1rsi.toFixed(1), verdict:'bull', weight:1,
        reason:`1H RSI過売り(${h1rsi.toFixed(0)})。短期反発が来やすい局面` })
  }

  // ════════════════════════════════════════
  // ポジション / FR (position)
  // ════════════════════════════════════════

  // BTC FR（複数取引所平均）
  const frBtc = fr.BTC?.avg
  if (frBtc != null) {
    if (frBtc > 0.05)
      push({ cat:'position', label:'BTC FR', value:`+${(frBtc*100).toFixed(3)}%`, verdict:'bear', weight:3,
        reason:`FR過熱(${(frBtc*100).toFixed(3)}%)。ロング積み過ぎで強制決済トリガーになりやすい。急落リスク高` })
    else if (frBtc > 0.02)
      push({ cat:'position', label:'BTC FR', value:`+${(frBtc*100).toFixed(3)}%`, verdict:'neutral', weight:1,
        reason:`ロング優位のFR。上昇継続中だが過熱に近づいており追いかけは慎重に` })
    else if (frBtc < -0.015)
      push({ cat:'position', label:'BTC FR', value:`${(frBtc*100).toFixed(3)}%`, verdict:'bull', weight:3,
        reason:`ショート優位のマイナスFR。売り方のコストが高く、スクイーズで急騰しやすい地合い` })
    else if (frBtc < 0)
      push({ cat:'position', label:'BTC FR', value:`${(frBtc*100).toFixed(3)}%`, verdict:'neutral', weight:1,
        reason:`わずかにショート優位。売り圧力がやや強いが過度な懸念は不要` })
  }

  // ETH FR（BTCの先行指標として機能することが多い）
  const frEth = fr.ETH?.avg
  if (frEth != null) {
    if (frEth > 0.06)
      push({ cat:'position', label:'ETH FR', value:`+${(frEth*100).toFixed(3)}%`, verdict:'bear', weight:2,
        reason:`ETH FRが過熱。ETHは通常BTCより先に過熱解消する。アルト全体に調整圧力波及リスク` })
    else if (frEth < -0.015)
      push({ cat:'position', label:'ETH FR', value:`${(frEth*100).toFixed(3)}%`, verdict:'bull', weight:1,
        reason:`ETH FRがマイナス。アルト市場でショート優位→スクイーズ時にBTCにも波及しやすい` })
  }

  // BTC Takerバランス（Binance 1H）
  const btcTaker = liq.bn_taker_ls?.BTC
  if (btcTaker?.ratio != null) {
    if (btcTaker.ratio > 1.15)
      push({ cat:'position', label:'Taker買/売', value:`${btcTaker.ratio.toFixed(3)} 買優勢`, verdict:'bull', weight:1,
        reason:`BinanceでBuy出来高がSell出来高を${((btcTaker.ratio-1)*100).toFixed(0)}%上回る。市場参加者の積極的な買いが継続` })
    else if (btcTaker.ratio < 0.87)
      push({ cat:'position', label:'Taker買/売', value:`${btcTaker.ratio.toFixed(3)} 売優勢`, verdict:'bear', weight:1,
        reason:`BinanceでSell出来高がBuy出来高を${((1-btcTaker.ratio)*100).toFixed(0)}%上回る。売り主導の地合い` })
  }

  // ホエール vs リテール乖離（逆張りシグナル）
  const topBtc    = liq.bn_top_ls?.BTC
  const acctBtc   = liq.bn_account_ls?.BTC
  if (topBtc?.ratio != null && acctBtc?.ratio != null) {
    const whaleL  = topBtc.ratio > 1   // 大口がLong優位
    const retailL = acctBtc.ratio > 1  // 一般がLong優位
    if (whaleL && !retailL)
      push({ cat:'position', label:'ホエール vs リテール', value:`大口Long / 一般Short`, verdict:'bull', weight:2,
        reason:`大口トレーダーがLong優位で一般がShort優位。通常、大口の判断の方が正確→上昇を示唆` })
    else if (!whaleL && retailL)
      push({ cat:'position', label:'ホエール vs リテール', value:`大口Short / 一般Long`, verdict:'bear', weight:2,
        reason:`大口がShort・一般がLong。一般ロングの清算を狙った下落が起きやすいパターン` })
  }

  // OI 24h変化（急増はポジション積み過ぎ、急減は清算完了）
  const oiChg24h = chg.oi_total_btc?.chg_24h
  const frChg24h = chg.fr_avg_btc?.chg_24h
  if (oiChg24h != null && Math.abs(oiChg24h) > 5) {
    if (oiChg24h > 8)
      push({ cat:'position', label:'OI変化(24h)', value:`+${oiChg24h.toFixed(1)}%`, verdict:'neutral', weight:1,
        reason:`OIが24hで${oiChg24h.toFixed(0)}%急増。新規ポジション流入中。FRも同時上昇なら過熱→FR確認必須` })
    else if (oiChg24h < -8)
      push({ cat:'position', label:'OI変化(24h)', value:`${oiChg24h.toFixed(1)}%`, verdict:'bull', weight:1,
        reason:`OIが大幅減少。強制清算で焼かれた後。ポジション整理完了→次の上昇への準備段階が多い` })
  }

  // ════════════════════════════════════════
  // フロー (flow)
  // ════════════════════════════════════════

  // ETFフロー
  const etfDaily = etf.daily_total_musd
  if (etfDaily != null) {
    if (etfDaily > 400)
      push({ cat:'flow', label:'ETF日次Flow', value:`+$${etfDaily.toFixed(0)}M`, verdict:'bull', weight:3,
        reason:`機関投資家が$${(etfDaily/1000).toFixed(1)}Bを1日でETF経由買付。現物需給を直撃する強い買い圧力` })
    else if (etfDaily > 100)
      push({ cat:'flow', label:'ETF日次Flow', value:`+$${etfDaily.toFixed(0)}M`, verdict:'bull', weight:2,
        reason:`ETF流入が継続。機関資金が安定的に流入しており中期の下値を支えている` })
    else if (etfDaily < -300)
      push({ cat:'flow', label:'ETF日次Flow', value:`$${etfDaily.toFixed(0)}M`, verdict:'bear', weight:3,
        reason:`ETFから大量流出($${Math.abs(etfDaily).toFixed(0)}M)。機関が撤退中。現物売り圧力が直接価格に影響` })
    else if (etfDaily < -100)
      push({ cat:'flow', label:'ETF日次Flow', value:`$${etfDaily.toFixed(0)}M`, verdict:'bear', weight:2,
        reason:`ETF流出継続。機関の買い需要が後退。上値が重くなりやすい` })
  }

  // 取引所フロー
  const netFlow = ef.net_usd
  if (netFlow != null) {
    if (netFlow < -150_000_000)
      push({ cat:'flow', label:'取引所フロー', value:`-$${(Math.abs(netFlow)/1e6).toFixed(0)}M 流出`, verdict:'bull', weight:2,
        reason:`取引所からBTCが大量流出。ホドラーが自己保管に移行→売り圧力の構造的低下。中長期強気` })
    else if (netFlow > 150_000_000)
      push({ cat:'flow', label:'取引所フロー', value:`+$${(netFlow/1e6).toFixed(0)}M 流入`, verdict:'bear', weight:2,
        reason:`取引所へBTC大量流入。売却準備が増えている。短期〜中期の売り圧力上昇リスク` })
  }

  // ステーブルコイン供給変化（市場への火薬）
  const scWeekly = sc.weekly_change_pct
  const scTotal  = sc.total_usd
  if (scWeekly != null) {
    if (scWeekly > 2)
      push({ cat:'flow', label:'SC供給週次変化', value:`+${(scWeekly*100).toFixed(1)}%/週`, verdict:'bull', weight:2,
        reason:`ステーブルコイン供給が週${(scWeekly*100).toFixed(1)}%増加($${scTotal ? (scTotal/1e9).toFixed(0) : '?'}B)。暗号市場に流入する資金が増えており上昇の燃料になる` })
    else if (scWeekly < -1.5)
      push({ cat:'flow', label:'SC供給週次変化', value:`${(scWeekly*100).toFixed(1)}%/週`, verdict:'bear', weight:1,
        reason:`ステーブルコイン供給が収縮。市場から資金が引き上げられており買い需要が細っている` })
  }

  // ════════════════════════════════════════
  // 清算 (liq)
  // ════════════════════════════════════════

  // 清算方向（4取引所合計）
  const shortLiq = (liq.okx_short_liq_btc||0) + (liq.binance_short_liq_btc||0) + (liq.bybit_short_liq_btc||0) + (liq.bitmex_short_liq_btc||0)
  const longLiq  = (liq.okx_long_liq_btc||0)  + (liq.binance_long_liq_btc||0)  + (liq.bybit_long_liq_btc||0)  + (liq.bitmex_long_liq_btc||0)
  const totalLiqBtc = shortLiq + longLiq
  if (totalLiqBtc > 0.5) {
    const ratio = shortLiq / (longLiq + 0.0001)
    if (ratio > 3)
      push({ cat:'liq', label:'清算方向', value:`SHORT ×${ratio.toFixed(1)} (${fmtN(totalLiqBtc)}BTC)`, verdict:'bull', weight:2,
        reason:`ショート清算がロングの${ratio.toFixed(1)}倍。売り方が一方的に損切りしており買い圧力強い。上昇トレンド強化` })
    else if (ratio < 0.33)
      push({ cat:'liq', label:'清算方向', value:`LONG ×${(1/ratio).toFixed(1)} (${fmtN(totalLiqBtc)}BTC)`, verdict:'bear', weight:2,
        reason:`ロング清算がショートの${(1/ratio).toFixed(1)}倍。買い方が清算されており売り圧力優勢。下落加速リスク` })
  }

  // 近接清算帯（3%以内で高警戒、5%以内で注意）
  if (price > 0) {
    const shortAbove = kl.next_short_liq
    const longBelow  = kl.next_long_liq
    if (shortAbove) {
      const dist = (shortAbove - price) / price * 100
      if (dist < 3)
        push({ cat:'liq', label:'ショート清算帯', value:`$${shortAbove.toLocaleString()} (+${dist.toFixed(1)}%)`, verdict:'bull', weight:3,
          reason:`${dist.toFixed(1)}%上にショート清算クラスター。ここを突破するとスクイーズで急騰しやすい。重要なトリガーゾーン` })
      else if (dist < 6)
        push({ cat:'liq', label:'ショート清算帯', value:`$${shortAbove.toLocaleString()} (+${dist.toFixed(1)}%)`, verdict:'bull', weight:1,
          reason:`${dist.toFixed(1)}%上にショート清算帯。近づくにつれてスクイーズ圧力が高まる` })
    }
    if (longBelow) {
      const dist = (price - longBelow) / price * 100
      if (dist < 3)
        push({ cat:'liq', label:'ロング清算帯', value:`$${longBelow.toLocaleString()} (-${dist.toFixed(1)}%)`, verdict:'bear', weight:3,
          reason:`${dist.toFixed(1)}%下にロング清算クラスター。下抜け→連鎖清算→急落のシナリオに警戒` })
      else if (dist < 6)
        push({ cat:'liq', label:'ロング清算帯', value:`$${longBelow.toLocaleString()} (-${dist.toFixed(1)}%)`, verdict:'bear', weight:1,
          reason:`${dist.toFixed(1)}%下にロング清算帯。サポート割れに注意が必要` })
    }
  }

  // 推定清算総額の非対称性
  const longEst  = lh.total_long_liq_est_usd  || 0
  const shortEst = lh.total_short_liq_est_usd || 0
  if (longEst > 0 && shortEst > 0) {
    const asymRatio = shortEst / longEst
    if (asymRatio > 1.5)
      push({ cat:'liq', label:'清算ポテンシャル', value:`SHORT $${(shortEst/1e9).toFixed(1)}B > LONG`, verdict:'bull', weight:1,
        reason:`上方のショート清算推定額が下方ロング清算より${asymRatio.toFixed(1)}倍多い。上昇時のエネルギーが大きい` })
    else if (asymRatio < 0.67)
      push({ cat:'liq', label:'清算ポテンシャル', value:`LONG $${(longEst/1e9).toFixed(1)}B > SHORT`, verdict:'bear', weight:1,
        reason:`下方のロング清算推定額が上方ショート清算より${(1/asymRatio).toFixed(1)}倍多い。下落時の加速リスクが大きい` })
  }

  // ════════════════════════════════════════
  // マクロ (macro)
  // ════════════════════════════════════════

  // 米10年金利（BTCとの逆相関）
  const us10y = mac.us10y
  if (us10y != null) {
    if (us10y > 4.8)
      push({ cat:'macro', label:'米10年金利', value:`${us10y.toFixed(2)}%`, verdict:'bear', weight:2,
        reason:`10年債金利高水準(${us10y.toFixed(2)}%)。リスク資産への資金流入が抑制され、BTCの上値が重くなる` })
    else if (us10y > 4.3)
      push({ cat:'macro', label:'米10年金利', value:`${us10y.toFixed(2)}%`, verdict:'neutral', weight:1,
        reason:`10年金利やや高め(${us10y.toFixed(2)}%)。BTCにとって逆風だが致命的ではない。方向性は他指標で判断` })
    else if (us10y < 3.5)
      push({ cat:'macro', label:'米10年金利', value:`${us10y.toFixed(2)}%`, verdict:'bull', weight:2,
        reason:`低金利環境(${us10y.toFixed(2)}%)。リスク資産に追い風。資金がBTCに流入しやすい環境` })
  }

  // イールドカーブ
  const ySpread = mac.yield_spread
  if (ySpread != null) {
    if (ySpread < -0.3)
      push({ cat:'macro', label:'イールドカーブ', value:`10Y-2Y: ${ySpread.toFixed(2)}%`, verdict:'bear', weight:1,
        reason:`逆イールド継続(${ySpread.toFixed(2)}%)。景気後退リスクを示唆。リスクオフ転換時にBTCも売られやすい` })
    else if (ySpread > 0.5)
      push({ cat:'macro', label:'イールドカーブ', value:`10Y-2Y: +${ySpread.toFixed(2)}%`, verdict:'bull', weight:1,
        reason:`正常なイールドカーブ。景気拡張期の典型。リスクオンムードが続きやすい環境` })
  }

  // Coinbase Premium（米国需要の代理変数）
  const cbp = d.coinbase_premium_pct
  if (cbp != null) {
    if (cbp > 0.003)
      push({ cat:'macro', label:'CB Premium', value:`+${(cbp*100).toFixed(3)}%`, verdict:'bull', weight:2,
        reason:`米国勢がCoinbaseで高値追い(+${(cbp*100).toFixed(3)}%)。機関・リテール問わず米国からの買い需要が強い状態` })
    else if (cbp < -0.003)
      push({ cat:'macro', label:'CB Premium', value:`${(cbp*100).toFixed(3)}%`, verdict:'bear', weight:2,
        reason:`Coinbaseでディスカウント(${(cbp*100).toFixed(3)}%)。米国勢が積極的に売っている。下押し圧力に注意` })
  }

  // ════════════════════════════════════════
  // モメンタム / ボラ (momentum)
  // ════════════════════════════════════════

  // BTCドミナンス変化（アルトコインへの資金流出入）
  const domChg7d = chg.btc_dominance?.chg_7d
  if (domChg7d != null && Math.abs(domChg7d) > 2) {
    if (domChg7d > 3)
      push({ cat:'momentum', label:'BTC Dominance', value:`+${domChg7d.toFixed(1)}%/7d`, verdict:'neutral', weight:1,
        reason:`BTC dominanceが7日で${domChg7d.toFixed(1)}%上昇。資金がアルトからBTCに集中中。アルトに注意` })
    else if (domChg7d < -3)
      push({ cat:'momentum', label:'BTC Dominance', value:`${domChg7d.toFixed(1)}%/7d`, verdict:'bull', weight:1,
        reason:`dominanceが低下、アルトシーズン化の兆候。市場全体のリスクオン。BTCにも流動性が波及` })
  }

  // DVOL（インプライドボラティリティ）
  const dvol = vol.dvol
  const rvol = vol.realized_vol
  const vrp  = vol.vrp  // DVOL - realized (正=オプション割高)
  if (dvol != null) {
    if (dvol > 80)
      push({ cat:'momentum', label:'DVOL', value:`${dvol.toFixed(1)} (高)`, verdict:'neutral', weight:2,
        reason:`オプション市場がボラ急騰(${dvol.toFixed(0)})を織り込んでいる。大きな価格変動が迫っている可能性。方向は他指標で判断` })
    else if (dvol < 45)
      push({ cat:'momentum', label:'DVOL', value:`${dvol.toFixed(1)} (低)`, verdict:'neutral', weight:1,
        reason:`ボラ低迷(${dvol.toFixed(0)})。エネルギーが蓄積するコイルドスプリング状態。一方向への大きな動きが近い可能性` })
  }

  // VRP（IV - RV: 正なら相場がオプションを割高評価）
  if (vrp != null && dvol != null && rvol != null) {
    if (vrp > 15)
      push({ cat:'momentum', label:'VRP(IV-RV)', value:`+${vrp.toFixed(1)} IV割高`, verdict:'bear', weight:1,
        reason:`インプライドボラ(${dvol.toFixed(0)})が実現ボラ(${rvol.toFixed(0)})を${vrp.toFixed(0)}pt上回る。相場が過度なリスクを織り込んでいる可能性` })
    else if (vrp < -10)
      push({ cat:'momentum', label:'VRP(IV-RV)', value:`${vrp.toFixed(1)} IV割安`, verdict:'bull', weight:1,
        reason:`実現ボラが高いのにIVが低い。相場がリスクを過少評価。予期せぬ急騰に対するオプションが安い` })
  }

  // 先物プレミアム（コンタンゴ/バックワーデーション）
  const fp = vol.futures_premium_pct
  if (fp != null) {
    if (fp > 0.5)
      push({ cat:'momentum', label:'先物プレミアム', value:`+${(fp).toFixed(2)}%`, verdict:'bull', weight:1,
        reason:`先物がスポットより${fp.toFixed(2)}%高いコンタンゴ。市場が将来の上昇を期待している状態` })
    else if (fp < -0.2)
      push({ cat:'momentum', label:'先物プレミアム', value:`${fp.toFixed(2)}%`, verdict:'bear', weight:1,
        reason:`バックワーデーション。先物がスポットより安い。市場が先行きを悲観。パニックの兆候` })
  }

  return sigs
}

// ナラティブ（全シグナルから2文要約を生成）
export function buildNarrative(sigs: Signal[], bias: string, bullPct: number): string {
  const bullTop = sigs.filter(s => s.verdict === 'bull').sort((a, b) => b.weight - a.weight)
  const bearTop = sigs.filter(s => s.verdict === 'bear').sort((a, b) => b.weight - a.weight)

  const techBull = bullTop.find(s => s.cat === 'tech')
  const techBear = bearTop.find(s => s.cat === 'tech')
  const flowBull = bullTop.find(s => s.cat === 'flow')
  const flowBear = bearTop.find(s => s.cat === 'flow')
  const liqBull  = bullTop.find(s => s.cat === 'liq')
  const liqBear  = bearTop.find(s => s.cat === 'liq')
  const posBull  = bullTop.find(s => s.cat === 'position')
  const posBear  = bearTop.find(s => s.cat === 'position')

  let sentence1 = ''
  let sentence2 = ''

  if (bias === 'BULL') {
    const mainBull = bullTop[0]
    sentence1 = mainBull ? `${mainBull.label}が強気を主導（${mainBull.value}）。` : `複数指標が強気を示している。`
    if (bearTop[0]) sentence1 += `ただし${bearTop[0].label}(${bearTop[0].value})に注意。`
    sentence2 = flowBull ? `${flowBull.label}(${flowBull.value})が継続しており中期の下値を支えている。` :
                liqBull  ? `${liqBull.label}(${liqBull.value})でスクイーズポテンシャルあり。` :
                           `押し目買いが有効な局面。`
  } else if (bias === 'BEAR') {
    const mainBear = bearTop[0]
    sentence1 = mainBear ? `${mainBear.label}が売り圧力を主導（${mainBear.value}）。` : `複数指標が弱気を示している。`
    if (bullTop[0]) sentence1 += `${bullTop[0].label}(${bullTop[0].value})は下値を支えうる。`
    sentence2 = liqBear  ? `${liqBear.label}(${liqBear.value})に注意が必要。` :
                flowBear ? `${flowBear.label}(${flowBear.value})が継続しており反発は限定的。` :
                           `戻り売りを基本戦略に。`
  } else {
    sentence1 = `強弱材料が拮抗している（BULL ${bullPct}% vs BEAR ${100-bullPct}%）。`
    const topAny = [...bullTop, ...bearTop].sort((a, b) => b.weight - a.weight)[0]
    sentence2 = topAny ? `特に${topAny.label}(${topAny.value})の方向性が明確になれば次の大きな動きが見えてくる。` :
                          `現在は様子見が賢明。明確なブレイクを待つべき局面。`
  }

  return sentence1 + sentence2
}
