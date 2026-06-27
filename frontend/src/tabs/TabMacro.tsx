'use client'

// ============================================================
// TabMacro — REBUILT with the ui/ design-system primitives.
// Data parity: same 6 macro items, same values, same labels, same
// color directions (10年金利 red>4.5/green<3.5; spread red<0/green>0).
// Only the structure/visuals changed.
// ============================================================

import { type ReactNode } from 'react'
import { Panel, Metric } from '@/components/ui'

// Old MetricColor → design-system text token (same hue as the old CSS var).
type MetricColor = 'default' | 'btc' | 'green' | 'red' | 'cyan'
const colorCls: Record<MetricColor, string> = {
  default: '',
  btc: 'text-accent',
  green: 'text-up',
  red: 'text-down',
  cyan: 'text-cool',
}
const tint = (cls: string, node: ReactNode) => (cls ? <span className={cls}>{node}</span> : node)

export function TabMacro({ d }: { d: any }) {
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
    <div className="flex flex-col gap-3">
      <Panel title="マクロ指標" accent action={<span className="text-2xs text-ink-muted">BTC相関市場</span>}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3">
          {items.map((i) => (
            <Metric key={i.label} label={i.label} value={tint(colorCls[i.color], i.value)} />
          ))}
        </div>
      </Panel>
    </div>
  )
}

export default TabMacro
