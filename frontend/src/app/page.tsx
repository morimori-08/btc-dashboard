'use client'

// ============================================================
// BTC NEXUS — dashboard shell (Phase 2b Wave 1).
//
// The 2386-line monolith was decomposed: shared logic -> src/lib/dashboard.ts,
// reusable inline helpers -> src/components/legacy, each tab -> src/tabs/*.
// This shell keeps the original state + 60s fetch loop + refresh logic intact,
// and swaps the inline header/tab-bar chrome for the ui/ <Header> + <Tabs>.
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import {
  ChartLineUp,
  Pulse,
  Waveform,
  ArrowsLeftRight,
  Globe,
  ClockCounterClockwise,
  Flame,
  ChartBar,
  Crosshair,
  TrendUp,
  Robot,
  type Icon,
} from '@phosphor-icons/react'
import { Header, Tabs, type TabItem } from '@/components/ui'
import { fetchLatest } from '../lib/api'
import { TABS } from '../lib/dashboard'

import { TabOverview } from '../tabs/TabOverview'
import { TabFROI } from '../tabs/TabFROI'
import { TabVol } from '../tabs/TabVol'
import { TabFlow } from '../tabs/TabFlow'
import { TabMacro } from '../tabs/TabMacro'
import { TabHistory } from '../tabs/TabHistory'
import { TabLiq } from '../tabs/TabLiq'
import { TabTech } from '../tabs/TabTech'
import { TabLiqMap } from '../tabs/TabLiqMap'
import { TabChanges } from '../tabs/TabChanges'
import { AiTradeTab } from '../tabs/AiTradeTab'

// Phosphor icon per tab id (no emoji / no em-dash per house rules).
const TAB_ICONS: Record<string, Icon> = {
  overview: ChartLineUp,
  fr:       Pulse,
  vol:      Waveform,
  flow:     ArrowsLeftRight,
  macro:    Globe,
  history:  ClockCounterClockwise,
  liq:      Flame,
  tech:     ChartBar,
  liqmap:   Crosshair,
  changes:  TrendUp,
  ai_trade: Robot,
}

export default function Page() {
  const [data, setData]           = useState<any>(null)
  const [tab, setTab]             = useState<string>('overview')
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

  // Render the active tab's body. Only the active tab mounts (Tabs renders
  // activeItem.content), matching the original `{tab === N && <TabX/>}`.
  const bodyFor = (id: string) => {
    switch (id) {
      case 'overview': return <TabOverview d={d} tech={tech} />
      case 'fr':       return <TabFROI d={d} />
      case 'vol':      return <TabVol d={d} />
      case 'flow':     return <TabFlow d={d} />
      case 'macro':    return <TabMacro d={d} />
      case 'history':  return <TabHistory />
      case 'liq':      return <TabLiq d={d} />
      case 'tech':     return <TabTech d={d} />
      case 'liqmap':   return <TabLiqMap d={d} />
      case 'changes':  return <TabChanges d={d} />
      case 'ai_trade': return <AiTradeTab />
      default:         return null
    }
  }

  const tabItems: TabItem[] = TABS.map(t => {
    const I = TAB_ICONS[t.id]
    return {
      id: t.id,
      label: t.label,
      icon: I ? <I size={14} weight="light" /> : undefined,
      content: t.id === tab ? bodyFor(t.id) : null,
    }
  })

  return (
    <div className="grain-overlay-host">
      <div className="grain-overlay" aria-hidden />

      <Header
        price={d.btc_price ?? null}
        live={!loading}
        lastUpdated={loading ? '更新中' : lastUpdate}
        onRefresh={refresh}
        refreshing={loading}
      />

      <main className="mx-auto w-full max-w-[1400px] px-2 pb-10 md:px-3">
        <Tabs
          items={tabItems}
          value={tab}
          onChange={setTab}
          sticky
          stickyOffset={52}
          ariaLabel="ダッシュボード タブ"
          className="pt-3"
        />
      </main>
    </div>
  )
}
