# BTC NEXUS — Premium Dark Terminal リデザイン + FX·On-chain 検証ゲート

承認済み設計（2026-06-27）。branch: `redesign/premium-terminal-fx`。**デプロイは人間ゲート。**

## Design Read
データ密度の高いトレード端末を、個人トレーダー向けにプレミアム・ダーク（Ethereal Glass）言語で刷新。
Next.js14 + Tailwind v3 維持。dials: **DENSITY高 / MOTION低(動機限定) / VARIANCE低**。
taste-skill自体は「ダッシュボード対象外」→ *素材感*のみ採用、巨大余白/特大タイポは不採用。
「Bloomberg級の密度 × Linear/soft級の素材品質」。

## A. デザイントークン（globals.css :root + tailwind.config theme.extend）
- フォント: UI=**Geist Sans**(Inter廃止, `geist`パッケージ/next/font) ／ 数値=**JetBrains Mono** + `tabular-nums`
- 背景: `--bg:#060709` `--bg-1:#0a0c10` `--bg-2:#0f1218`（純黒回避）
- ガラス: `--glass:rgba(255,255,255,.024)` `--glass-2:rgba(255,255,255,.045)`
- ヘアライン: `--hairline:rgba(255,255,255,.08)` `--hairline-2:rgba(255,255,255,.13)`
- アクセント(単一ロック): `--accent:#F7931A` `--accent-soft:rgba(247,147,26,.13)`
- 補助(脱彩度・控えめ): `--cool:#4FB6C7`
- 意味色(データ符号): `--up:#2DBE84` `--down:#F05D72`
- 文字: `--text:#E9EEF5` `--text-dim:#92A0B2` `--text-muted:#5C6878`
- 影(色付き・柔): `--shadow:0 10px 34px -8px rgba(0,0,0,.55)`／内側ハイライト`inset 0 1px 0 rgba(255,255,255,.05)`／アクセント発光は限定使用
- 角丸(1系統): `--r-lg:16px`(パネル) `--r-md:12px`(内核) `--r-sm:8px` `--r-pill:999px`
- 素材: **ダブルベゼル**（外殻=glass+hairline+p-[5px]+r-lg、内核=bg-1+inset highlight+r-md・同心半径）
- グラスblurは**固定ヘッダ/タブのみ**（スクロール領域に掛けない=性能）／ノイズは固定pointer-events-none層

## B. プリミティブ部品（frontend/src/components/ui/）
`Panel`(ダブルベゼル) / `Metric`(label+mono tabular値+delta+任意spark) / `Sparkline`(SVG) /
`DataTable`(ヘアライン区切り・tabular-nums・任意ヒートセル) / `HeatCell` / `Badge`(BULL/BEAR/確信度) /
`SignalBanner` / `Tabs`(固定ガラス・activeインジケータ・キーボード可) / `Header`(固定ガラス・価格tick・LIVE点パルス) /
状態: `Skeleton` `EmptyState` `ErrorState`(60s更新失敗を明示)。全部品: focusリング/hover/`active:scale .99`/`prefers-reduced-motion`順守。
モーション: タブ切替クロスフェード(150-200ms `cubic-bezier(.32,.72,0,1)`)・値tickフラッシュ・LIVE点パルス・行hover lift。スクロールハイジャック無し。

## C. アーキテクチャ
2386行の`page.tsx`→シェル+状態に縮小。タブ別`tabs/*.tsx`へ分割。未使用`/components`とインライン重複を統合、ローソク実装2本を1本化。スタック移行なし(lightweight-charts/recharts/Tailwind v3維持)。

## D. FX·On-chain（検証ゲート方式 — 合格指標のみ表示）
データ配管 実測結果(2026-06-27):
- ✅鉄板: ステーブル供給/DeFi TVL/チェーン別(DefiLlama・無料・最新当日・履歴2017〜)
- ⚠️Aave借入レート: 無料履歴なし(The Graph hosted終了)→公開RPC直読は現在値のみ＝**検証用履歴が無いため検証対象外/保留**
- ❌CoinGecko stablecoin%フィールド: 不在(自前計算)

特徴量(日次・全て`shift(1)`): sc_supply Δ1w/Δ4w, defi_tvl Δ1w, chain_split eth_tron_ratio Δ, btc_weekend_return(金→月)。

**検証(あなたの規律)**: TRAIN2023-24 / TEST2025-2026-06、先読み排除(shift1・次足始値約定)、WF-OOS≥2分割、**PF≥1.3 / ±20%頑健 / 1パラ≥20トレード / 現実コスト込**。合格した特徴量だけ`onchain_fx.validated.pass`で**FXタブに表示**。ゼロなら「検証済みエッジなし」と正直表示。

snapshot拡張: `onchain_fx:{asof, sc_supply_usd, sc_d1w_pct, sc_d4w_pct, defi_tvl_usd, tvl_d1w_pct, chain_split:{eth_usd,tron_usd,eth_tron_ratio,ratio_d1w}, btc_weekend_return_pct, validated:{...}}`

## フェーズ / 分業
P1 デザインシステム+部品(Opusサブ) → P2 タブ刷新(Sonnetサブ) ‖ B: FX検証(Opusサブ)→合格時のみ収集+FXタブ。
各段階でメイン(私)がレビュー/build・lint検証。先読み監査(PHASE3相当)を私が実施。**デプロイは人間ゲート。**
