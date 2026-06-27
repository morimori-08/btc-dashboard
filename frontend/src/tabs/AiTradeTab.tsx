'use client'

// ============================================================
// AiTradeTab: REBUILT with the ui/ design-system primitives
// (Panel / Badge). Data parity with the former inline AiTradeTab:
// the open-position card (LONG/SHORT size @ entry, or FLAT), and the list of
// expandable signal cards. The expand/collapse interaction and the
// AnalysisPanel-style report rendering (final decision, the 4 analyst
// reports, the Bull/Bear debate, the risk-management debate, all via
// stripMd) are kept EXACTLY. Only the outer containers became Panels and the
// signal label became a Badge.
//
// NOTE: the report/section labels contain emoji and the debate arrows. These
// are existing user-facing content carried over verbatim for data parity (the
// "no emoji" house style applies to newly authored copy, not to preserved
// data shown to the user).
// ============================================================

import { useState, useEffect } from 'react'
import { Panel, Badge, type BadgeTone } from '@/components/ui'

// Markdownの装飾記号を除去して読みやすくする
function stripMd(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')   // **bold** → bold
    .replace(/\*([^*]+)\*/g, '$1')         // *italic* → italic
    .replace(/#{1,6}\s*/g, '')             // ### heading → heading
    .replace(/`([^`]+)`/g, '$1')           // `code` → code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
    .replace(/\n{3,}/g, '\n\n')            // 3連続改行→2つに
    .trim()
}

export function AiTradeTab() {
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/paper-trades')
      .then(r => r.json())
      .then(d => { setTrades(d.trades || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const currentPosition = trades.find(t => t.side && t.status === 'open')
  const signals = trades.slice(0, 30)

  // Same direction mapping as the legacy sigColor: Buy/Overweight → bull,
  // Sell/Underweight → bear, otherwise neutral.
  const sigTone = (s: string): BadgeTone =>
    ['Buy','Overweight'].includes(s) ? 'bull' :
    ['Sell','Underweight'].includes(s) ? 'bear' : 'neutral'

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <div className="mb-2 text-2xs font-medium uppercase tracking-label text-ink-muted">現在ポジション</div>
        {currentPosition ? (
          <div style={{ fontSize: 24, fontWeight: 700, color: currentPosition.side === 'LONG' ? '#00d4a0' : '#ff6b6b' }}>
            {currentPosition.side} {currentPosition.size_btc} BTC
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginLeft: 12 }}>
              @ ${Number(currentPosition.entry_price).toLocaleString()}
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 18, color: '#888' }}>FLAT（ポジションなし）</div>
        )}
      </Panel>

      {loading ? (
        <Panel><div style={{ color: '#888' }}>読み込み中...</div></Panel>
      ) : signals.length === 0 ? (
        <Panel><div style={{ color: '#888' }}>まだデータがありません。</div></Panel>
      ) : signals.map((t, i) => {
        let debate: any = null
        let risk: any = null
        try { debate = t.investment_debate ? (typeof t.investment_debate === 'string' ? JSON.parse(t.investment_debate) : t.investment_debate) : null } catch {}
        try { risk = t.risk_debate ? (typeof t.risk_debate === 'string' ? JSON.parse(t.risk_debate) : t.risk_debate) : null } catch {}

        return (
          <Panel key={i}>
            {/* ヘッダー */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <Badge tone={sigTone(t.signal)}>{t.signal}</Badge>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{t.trade_date || t.ts?.slice(0,10)}</span>
              {t.btc_price && <span style={{ fontSize: 13, color: '#f7931a', marginLeft: 'auto' }}>${Number(t.btc_price).toLocaleString()}</span>}
            </div>

            {/* 最終判断 */}
            {t.final_trade_decision && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, fontWeight: 600 }}>💼 最終判断（Portfolio Manager）</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', whiteSpace: 'pre-wrap', lineHeight: 1.8, background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '10px 12px' }}>
                  {stripMd(t.final_trade_decision)}
                </div>
              </div>
            )}

            {/* 各アナリストレポート（クリックで展開） */}
            <div
              onClick={() => setExpanded(expanded === i ? null : i)}
              style={{ cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: expanded === i ? 12 : 0, userSelect: 'none' }}
            >
              {expanded === i ? '▲ アナリストレポート・ディベートを閉じる' : '▼ アナリストレポート・ディベートを見る'}
            </div>

            {expanded === i && (
              <div>
                {/* アナリストレポート */}
                {[
                  { label: '🔬 デリバティブ分析', key: 'market_report' },
                  { label: '🌍 マクロ・センチメント', key: 'sentiment_report' },
                  { label: '📈 テクニカル', key: 'news_report' },
                  { label: '📋 投資計画（Research Manager）', key: 'investment_plan' },
                ].map(({ label, key }) => t[key] ? (
                  <div key={key} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', whiteSpace: 'pre-wrap', lineHeight: 1.7, background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '8px 10px' }}>
                      {stripMd(t[key])}
                    </div>
                  </div>
                ) : null)}

                {/* Bull vs Bear ディベート */}
                {debate && (debate.bull_history || debate.bear_history) && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 600 }}>🐂🐻 Bull vs Bear ディベート</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {debate.bull_history && (
                        <div style={{ background: 'rgba(0,212,160,0.06)', borderRadius: 6, padding: 10 }}>
                          <div style={{ fontSize: 10, color: '#00d4a0', marginBottom: 6, fontWeight: 700 }}>🐂 BULL</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{stripMd(debate.bull_history)}</div>
                        </div>
                      )}
                      {debate.bear_history && (
                        <div style={{ background: 'rgba(255,107,107,0.06)', borderRadius: 6, padding: 10 }}>
                          <div style={{ fontSize: 10, color: '#ff6b6b', marginBottom: 6, fontWeight: 700 }}>🐻 BEAR</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{stripMd(debate.bear_history)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* リスク管理ディベート */}
                {risk && (risk.aggressive_history || risk.neutral_history || risk.conservative_history) && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 600 }}>⚖️ リスク管理ディベート</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                      {risk.aggressive_history && (
                        <div style={{ background: 'rgba(247,147,26,0.06)', borderRadius: 6, padding: 10 }}>
                          <div style={{ fontSize: 10, color: '#f7931a', marginBottom: 6, fontWeight: 700 }}>⚡ AGGRESSIVE</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{stripMd(risk.aggressive_history)}</div>
                        </div>
                      )}
                      {risk.neutral_history && (
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: 10 }}>
                          <div style={{ fontSize: 10, color: '#888', marginBottom: 6, fontWeight: 700 }}>⚖️ NEUTRAL</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{stripMd(risk.neutral_history)}</div>
                        </div>
                      )}
                      {risk.conservative_history && (
                        <div style={{ background: 'rgba(100,200,255,0.06)', borderRadius: 6, padding: 10 }}>
                          <div style={{ fontSize: 10, color: '#64c8ff', marginBottom: 6, fontWeight: 700 }}>🛡️ CONSERVATIVE</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{stripMd(risk.conservative_history)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Panel>
        )
      })}
    </div>
  )
}

export default AiTradeTab
