'use client'

import { useEffect, useState } from 'react'
import {
  TrendUp,
  TrendDown,
  Lightning,
  ChartLineUp,
  Pulse,
  Broadcast,
  WifiHigh,
} from '@phosphor-icons/react'
import {
  Panel,
  Metric,
  Sparkline,
  DataTable,
  type Column,
  HeatCell,
  Badge,
  SignalBanner,
  Tabs,
  Header,
  Skeleton,
  MetricSkeleton,
  TableSkeleton,
  EmptyState,
  ErrorState,
} from '@/components/ui'

// ============================================================
// Realistic sample data (messy, not round). Mock only — preview.
// ============================================================

type FrRow = {
  coin: string
  avg: number
  max: number
  min: number
  oi: number // open interest, USD
  d24: number // 24h price change %
  spark: number[]
}

const FR_ROWS: FrRow[] = [
  { coin: 'BTC', avg: 0.000094, max: 0.000181, min: 0.000022, oi: 38_417_900_000, d24: 1.83, spark: [108200, 108940, 108510, 109380, 109120, 109847] },
  { coin: 'ETH', avg: 0.000128, max: 0.000244, min: 0.000041, oi: 19_206_400_000, d24: 2.41, spark: [2588, 2602, 2571, 2640, 2628, 2671] },
  { coin: 'SOL', avg: 0.000211, max: 0.000392, min: 0.000067, oi: 4_731_080_000, d24: 4.12, spark: [186.4, 189.1, 184.7, 191.3, 188.9, 193.6] },
  { coin: 'XRP', avg: -0.000031, max: 0.000044, min: -0.000118, oi: 3_092_550_000, d24: -0.74, spark: [2.41, 2.39, 2.44, 2.36, 2.4, 2.37] },
  { coin: 'BNB', avg: 0.000052, max: 0.000133, min: -0.000009, oi: 1_884_220_000, d24: 0.61, spark: [642.1, 644.8, 639.2, 648.3, 645.9, 647.4] },
  { coin: 'DOGE', avg: -0.000087, max: 0.000012, min: -0.000204, oi: 1_204_770_000, d24: -2.18, spark: [0.1731, 0.1718, 0.1742, 0.1689, 0.1701, 0.1672] },
  { coin: 'HYPE', avg: 0.000343, max: 0.000611, min: 0.000094, oi: 842_390_000, d24: 6.74, spark: [27.4, 28.1, 26.9, 29.3, 28.7, 30.2] },
  { coin: 'LINK', avg: 0.000019, max: 0.000088, min: -0.000041, oi: 612_140_000, d24: 0.92, spark: [13.41, 13.52, 13.38, 13.61, 13.49, 13.58] },
]

type EtfRow = { name: string; flow: number; aum: number }
const ETF_ROWS: EtfRow[] = [
  { name: 'IBIT', flow: 312.4, aum: 52_184.0 },
  { name: 'FBTC', flow: 87.1, aum: 19_402.7 },
  { name: 'BITB', flow: -14.6, aum: 2_318.9 },
  { name: 'ARKB', flow: 41.8, aum: 3_927.4 },
  { name: 'GBTC', flow: -58.3, aum: 18_661.2 },
]

const fmtPct = (v: number, d = 4) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(d)}%`
const fmtUsd = (v: number) => `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
const fmtB = (v: number) => `$${(v / 1e9).toFixed(2)}B`
const fmtM = (v: number) => `${v >= 0 ? '+' : ''}$${Math.abs(v).toFixed(1)}M`

// ============================================================
// Funding-rate heatmap table (HeatCell driven)
// ============================================================

function FundingHeatmap() {
  const cols: Column<FrRow>[] = [
    { key: 'coin', header: '銘柄', align: 'left', cell: (r) => <span className="font-semibold text-ink">{r.coin}</span> },
    { key: 'avg', header: '平均FR', align: 'right', heat: (r) => r.avg, heatScale: 0.0003, cell: (r) => fmtPct(r.avg) },
    { key: 'max', header: '最大', align: 'right', heat: (r) => r.max, heatScale: 0.0006, cell: (r) => fmtPct(r.max) },
    { key: 'min', header: '最小', align: 'right', heat: (r) => r.min, heatScale: 0.0006, cell: (r) => fmtPct(r.min) },
    { key: 'oi', header: 'OI', align: 'right', cell: (r) => fmtB(r.oi) },
    {
      key: 'd24',
      header: '24h',
      align: 'right',
      cell: (r) => (
        <span className={r.d24 >= 0 ? 'text-up' : 'text-down'}>
          {r.d24 >= 0 ? '+' : ''}
          {r.d24.toFixed(2)}%
        </span>
      ),
    },
    { key: 'trend', header: 'トレンド', align: 'right', mono: false, cell: (r) => <div className="flex justify-end"><Sparkline data={r.spark} width={70} height={20} /></div> },
  ]
  return <DataTable columns={cols} rows={FR_ROWS} rowKey={(r) => r.coin} minWidth={620} caption="資金調達率ヒートマップ" />
}

// ============================================================
// Page
// ============================================================

export default function PreviewPage() {
  const [price, setPrice] = useState<number | null>(109_847)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState('12:04:33')

  // Drive a periodic tick so the Header price-flash is visibly exercised.
  useEffect(() => {
    const id = setInterval(() => {
      setPrice((p) => {
        if (p == null) return p
        const drift = Math.round((Math.random() - 0.48) * 140)
        return p + drift
      })
      const now = new Date()
      setLastUpdated(now.toTimeString().slice(0, 8))
    }, 2200)
    return () => clearInterval(id)
  }, [])

  const fakeRefresh = () => {
    setRefreshing(true)
    setTimeout(() => {
      setPrice((p) => (p ?? 109_847) + Math.round((Math.random() - 0.5) * 260))
      setLastUpdated(new Date().toTimeString().slice(0, 8))
      setRefreshing(false)
    }, 900)
  }

  const tabItems = [
    {
      id: 'overview',
      label: '概要',
      icon: <ChartLineUp size={14} weight="light" />,
      content: (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Panel dense><Metric label="価格 (BTC)" value={fmtUsd(price ?? 0)} delta={1.83} deltaLabel="+1.83%" size="md" sub="24h" spark={[108200, 108940, 108510, 109380, 109120, price ?? 109847]} /></Panel>
          <Panel dense><Metric label="建玉 合計" value="$71.4B" delta={3.27} deltaLabel="+3.27%" size="md" sub="全取引所" /></Panel>
          <Panel dense><Metric label="DVOL" value="48.62" delta={-2.14} deltaLabel="-2.14" size="md" sub="Deribit IV" /></Panel>
          <Panel dense><Metric label="Long/Short" value="1.84" delta={0.12} deltaLabel="+0.12" size="md" sub="比率" /></Panel>
        </div>
      ),
    },
    {
      id: 'funding',
      label: 'FR / OI',
      icon: <Pulse size={14} weight="light" />,
      content: (
        <Panel title="資金調達率ヒートマップ" action={<Badge tone="accent" size="sm">8 銘柄</Badge>}>
          <FundingHeatmap />
        </Panel>
      ),
    },
    {
      id: 'flow',
      label: 'ETF フロー',
      icon: <Lightning size={14} weight="light" />,
      content: (
        <Panel title="現物 ETF ネットフロー (昨日)">
          <DataTable
            columns={[
              { key: 'name', header: 'ファンド', align: 'left', cell: (r: EtfRow) => <span className="font-semibold text-ink">{r.name}</span> },
              { key: 'flow', header: 'ネットフロー', align: 'right', heat: (r: EtfRow) => r.flow, heatScale: 200, cell: (r: EtfRow) => fmtM(r.flow) },
              { key: 'aum', header: 'AUM', align: 'right', cell: (r: EtfRow) => `$${r.aum.toLocaleString('en-US', { maximumFractionDigits: 0 })}M` },
            ] as Column<EtfRow>[]}
            rows={ETF_ROWS}
            rowKey={(r) => r.name}
            minWidth={420}
          />
        </Panel>
      ),
    },
    { id: 'disabled', label: '清算MAP', icon: <Broadcast size={14} weight="light" />, disabled: true, content: null },
  ]

  return (
    <>
      {/* fixed grain overlay (pointer-events-none, z-grain) */}
      <div className="grain-overlay" aria-hidden />

      <Header
        price={price}
        lastUpdated={lastUpdated}
        onRefresh={fakeRefresh}
        refreshing={refreshing}
        live
      >
        <span className="hidden items-center gap-1 md:flex">
          <WifiHigh size={14} weight="light" className="text-up" aria-hidden />
          <span className="text-2xs tabular font-mono text-ink-muted">38ms</span>
        </span>
      </Header>

      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 py-6 md:px-6">
        {/* title row */}
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-bold tracking-tight text-ink">デザインシステム プレビュー</h1>
          <p className="text-2xs text-ink-dim">
            プレミアム ダーク ターミナル — 全プリミティブと状態をサンプルデータで確認。
          </p>
        </div>

        {/* Signal banners */}
        <section className="flex flex-col gap-3">
          <SectionLabel icon={<TrendUp size={13} weight="light" />}>シグナルバナー</SectionLabel>
          <SignalBanner signal="BULL" score={2.4} price={price} confidence="STRONG" />
          <SignalBanner signal="BEAR" score={-1.8} price={61_204} confidence="PLAUSIBLE" />
          <SignalBanner signal="NEUTRAL" score={0.3} price={null} loading />
        </section>

        {/* Tabs (sticky glass) */}
        <section className="flex flex-col gap-3">
          <SectionLabel icon={<ChartLineUp size={13} weight="light" />}>タブ (固定ガラス)</SectionLabel>
          <Tabs items={tabItems} sticky stickyOffset={52} defaultValue="funding" />
        </section>

        {/* Metric grid — sizes + deltas + sparklines */}
        <section className="flex flex-col gap-3">
          <SectionLabel icon={<Pulse size={13} weight="light" />}>メトリクス (sm / md / lg)</SectionLabel>
          <Panel>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3 lg:grid-cols-4">
              <Metric size="lg" label="BTC 現物" value={fmtUsd(price ?? 0)} delta={1.83} deltaLabel="+1.83%" sub="Coinbase" spark={FR_ROWS[0].spark} />
              <Metric size="md" label="ETH 現物" value="$2,671" delta={2.41} deltaLabel="+2.41%" sub="Binance" spark={FR_ROWS[1].spark} />
              <Metric size="md" label="SOL 現物" value="$193.6" delta={4.12} deltaLabel="+4.12%" sub="OKX" spark={FR_ROWS[2].spark} />
              <Metric size="md" label="XRP 現物" value="$2.37" delta={-0.74} deltaLabel="-0.74%" sub="Bybit" spark={FR_ROWS[3].spark} />
              <Metric size="sm" label="恐怖貪欲" value="72" delta={4} deltaLabel="+4" sub="貪欲" />
              <Metric size="sm" label="優勢度" value="58.3%" delta={-0.4} deltaLabel="-0.40%" sub="BTC.D" />
              <Metric size="sm" label="清算 (24h)" value="$184.2M" delta={-12.7} deltaLabel="-12.7%" sub="ロング偏重" align="right" />
              <Metric size="sm" label="出来高 (24h)" value="$41.9B" delta={6.1} deltaLabel="+6.10%" sub="現物" align="right" />
            </div>
          </Panel>
        </section>

        {/* Standalone sparklines + heatcell legend */}
        <section className="flex flex-col gap-3">
          <SectionLabel icon={<Pulse size={13} weight="light" />}>スパークライン &amp; ヒートセル</SectionLabel>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Panel title="スパークライン (line / area)">
              <div className="flex flex-col gap-4">
                <SparkRow label="上昇 (area)"><Sparkline data={FR_ROWS[6].spark} width={140} height={34} tone="up" /></SparkRow>
                <SparkRow label="下落 (area)"><Sparkline data={FR_ROWS[5].spark} width={140} height={34} tone="down" /></SparkRow>
                <SparkRow label="線のみ"><Sparkline data={FR_ROWS[0].spark} width={140} height={34} tone="accent" area={false} /></SparkRow>
                <SparkRow label="データ不足"><Sparkline data={[1]} width={140} height={34} /></SparkRow>
              </div>
            </Panel>
            <Panel title="ヒートセル (符号 × 強度)">
              <table className="w-full border-collapse">
                <tbody>
                  {[0.000392, 0.000181, 0.000052, 0.0, -0.000031, -0.000118, -0.000204].map((v, i) => (
                    <tr key={i} className="border-b border-hairline last:border-b-0">
                      <td className="py-1.5 text-2xs text-ink-dim">{v === 0 ? '中立' : v > 0 ? `ロング ${i}` : `ショート ${i}`}</td>
                      <HeatCell value={v} scale={0.0004} format={(x) => fmtPct(x ?? 0)} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>
        </section>

        {/* Badges */}
        <section className="flex flex-col gap-3">
          <SectionLabel icon={<Lightning size={13} weight="light" />}>バッジ</SectionLabel>
          <Panel>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="bull" dot>BULL</Badge>
              <Badge tone="bear" dot>BEAR</Badge>
              <Badge tone="neutral" dot>NEUTRAL</Badge>
              <Badge tone="accent">STRONG</Badge>
              <Badge tone="muted">PLAUSIBLE</Badge>
              <Badge tone="up">+2.41%</Badge>
              <Badge tone="down">-1.83%</Badge>
              <Badge tone="cool">DVOL 48.6</Badge>
              <Badge tone="accent" size="sm">sm</Badge>
            </div>
          </Panel>
        </section>

        {/* Data table — dense + standard */}
        <section className="flex flex-col gap-3">
          <SectionLabel icon={<ChartLineUp size={13} weight="light" />}>データテーブル (標準 / 密)</SectionLabel>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Panel title="標準" action={<Badge tone="neutral" size="sm">{FR_ROWS.length} 行</Badge>}>
              <FundingHeatmap />
            </Panel>
            <Panel title="密モード (dense)">
              <DataTable
                dense
                columns={[
                  { key: 'coin', header: '銘柄', align: 'left', cell: (r: FrRow) => <span className="font-semibold text-ink">{r.coin}</span> },
                  { key: 'avg', header: '平均FR', align: 'right', heat: (r: FrRow) => r.avg, heatScale: 0.0003, cell: (r: FrRow) => fmtPct(r.avg, 4) },
                  { key: 'oi', header: 'OI', align: 'right', cell: (r: FrRow) => fmtB(r.oi) },
                ] as Column<FrRow>[]}
                rows={FR_ROWS}
                rowKey={(r) => r.coin}
                minWidth={320}
              />
            </Panel>
          </div>
        </section>

        {/* States: loading / empty / error */}
        <section className="flex flex-col gap-3">
          <SectionLabel icon={<Broadcast size={13} weight="light" />}>状態 (loading / empty / error)</SectionLabel>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Panel title="ローディング">
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-4">
                  <MetricSkeleton />
                  <MetricSkeleton />
                </div>
                <TableSkeleton rows={4} cols={3} />
                <div className="flex items-center gap-3">
                  <Skeleton w={30} h={30} rounded="core" />
                  <Skeleton w="55%" h={12} />
                </div>
              </div>
            </Panel>
            <Panel title="空">
              <EmptyState
                title="該当データなし"
                description="この期間に記録された資金調達率イベントはありません。期間を広げて再検索してください。"
                action={<Badge tone="accent" size="sm">期間を変更</Badge>}
              />
            </Panel>
            <Panel title="エラー (60秒更新失敗)">
              <ErrorState lastUpdated={lastUpdated} onRetry={fakeRefresh} retrying={refreshing} />
            </Panel>
          </div>
        </section>

        {/* Live connection demo */}
        <section className="flex flex-col gap-3 pb-10">
          <SectionLabel icon={<WifiHigh size={13} weight="light" />}>ライブ価格 tick フラッシュ</SectionLabel>
          <Panel hover>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Metric size="lg" label="BTC / USD (ライブ)" value={fmtUsd(price ?? 0)} sub={`最終更新 ${lastUpdated}`} />
              <p className="max-w-[42ch] text-2xs leading-relaxed text-ink-dim">
                上部ヘッダーの価格は値が変わるたびに緑/赤へ tick フラッシュします。約2.2秒ごとに更新中。更新ボタンでも手動取得を再現できます。
              </p>
            </div>
          </Panel>
        </section>
      </main>
    </>
  )
}

// ---- small local helpers (preview only) ----

function SectionLabel({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon && <span className="text-ink-muted">{icon}</span>}
      <h2 className="text-2xs font-semibold uppercase tracking-wide2 text-ink-dim">{children}</h2>
    </div>
  )
}

function SparkRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-2xs text-ink-dim">{label}</span>
      {children}
    </div>
  )
}
