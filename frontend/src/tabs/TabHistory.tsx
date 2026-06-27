'use client'

// ============================================================
// TabHistory: REBUILT with the ui/ design-system primitives
// (Panel / Metric / Badge). Data parity with the former inline TabHistory:
// the period selector (1H/6H/24H/7D), the metric selector (BTC価格/DVOL/
// BTC FR/Mempool), the Supabase history fetch + mapping, the bespoke SVG
// area chart (kept verbatim: it is not one of the shared legacy charts),
// and the 4 summary metrics (latest / change% / period max / period min).
// Only the surrounding structure/visuals changed.
// ============================================================

import { useState, useEffect, type ReactNode } from 'react'
import { Panel, Metric, Badge } from '@/components/ui'
import { cn } from '@/components/ui'

export function TabHistory() {
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

  // tint helper (same pattern as TabOverview): preserve the exact value string
  // with the same color intent (no fabricated arrows the original did not have).
  const tint = (cls: string, node: ReactNode) =>
    cls ? <span className={cls}>{node}</span> : node

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
    const fmt2 = (dd:Date) => `${dd.getMonth()+1}/${dd.getDate()} ${dd.getHours()}:${String(dd.getMinutes()).padStart(2,'0')}`

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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1">
          {[{h:1,l:'1H'},{h:6,l:'6H'},{h:24,l:'24H'},{h:168,l:'7D'}].map(({h,l})=>(
            <button key={h} onClick={()=>setPeriod(h)}
              className={cn('tab-btn', period===h && 'active')}
              style={{padding:'6px 12px',fontSize:'0.72rem'}}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {([
            ['btc_price','BTC価格'],['dvol','DVOL'],
            ['fr_btc','BTC FR'],['mempool','Mempool'],
          ] as [string,string][]).map(([k,l])=>(
            <button key={k} onClick={()=>setMetric(k as 'btc_price'|'dvol'|'fr_btc'|'mempool')}
              className={cn('tab-btn', metric===k && 'active')}
              style={{padding:'6px 12px',fontSize:'0.72rem'}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <Panel
        title={`${METRIC_LABELS[metric]} — 直近${period >= 168 ? '7D' : period >= 24 ? '24H' : `${period}H`}`}
        accent
        action={
          <Badge tone="muted" size="sm">
            {loading ? '読込中...' : `${points.length}件のスナップショット`}
          </Badge>
        }
      >
        {renderChart()}
      </Panel>

      {points.length >= 2 && (() => {
        const vals = points.map(p => p.val as number)
        const latest = vals[vals.length-1]
        const oldest = vals[0]
        const chgPct = ((latest - oldest) / oldest * 100)
        const max = Math.max(...vals)
        const min = Math.min(...vals)
        const fmtV = (v: number) => metric==='btc_price' ? `$${Math.round(v).toLocaleString()}` : v.toFixed(3)
        return (
          <Panel>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
              <Metric label="最新値" value={tint('text-accent', fmtV(latest))} />
              <Metric
                label={`${period>=168?'7D':period>=24?'24H':`${period}H`}変化`}
                value={tint(chgPct>=0?'text-up':'text-down', `${chgPct>=0?'+':''}${chgPct.toFixed(2)}%`)}
              />
              <Metric label="期間最高値" value={fmtV(max)} />
              <Metric label="期間最安値" value={fmtV(min)} />
            </div>
          </Panel>
        )
      })()}
    </div>
  )
}

export default TabHistory
