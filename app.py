"""
BTC Market Dashboard - Real-time market data visualization
"""

import time
import asyncio
import datetime
import random
import math

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots

# ---------------------------------------------------------------------------
# Page config (must be first Streamlit call)
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="BTC Market Dashboard",
    page_icon="₿",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ---------------------------------------------------------------------------
# Custom CSS
# ---------------------------------------------------------------------------
st.markdown(
    """
<style>
/* ===== ダーク基調 ===== */
.metric-card {
    background: #1e2130;
    border-radius: 8px;
    padding: 16px;
    margin: 4px 0;
}
.fr-positive { color: #ff4444; }
.fr-negative { color: #4488ff; }

/* ===== メトリクスカード ===== */
[data-testid="metric-container"] {
    background: #1e2130;
    border: 1px solid #2d3250;
    border-radius: 10px;
    padding: 12px 16px;
}
[data-testid="stMetricValue"] { font-size: 1.35rem; font-weight: 700; }
[data-testid="stMetricLabel"] { font-size: 0.75rem; color: #9aa0b4; }

/* ===== タブ ===== */
button[data-baseweb="tab"] { font-size: 0.82rem; padding: 8px 10px; }
[data-baseweb="tab-list"] { overflow-x: auto; flex-wrap: nowrap; }

/* ===== テーブル ===== */
.dataframe { font-size: 0.78rem; }
[data-testid="stDataFrame"] > div { overflow-x: auto !important; }

/* ===== モバイル対応 ===== */
@media (max-width: 768px) {
    /* メトリクス値を小さく */
    [data-testid="stMetricValue"] { font-size: 1.1rem !important; }
    [data-testid="stMetricLabel"] { font-size: 0.68rem !important; }
    /* メインパディング縮小 */
    .main .block-container { padding: 0.5rem 0.75rem 2rem !important; }
    /* タブ文字縮小 */
    button[data-baseweb="tab"] { font-size: 0.72rem !important; padding: 6px 7px !important; }
    /* テーブル横スクロール */
    [data-testid="stDataFrame"] { overflow-x: scroll !important; }
    .dataframe { font-size: 0.7rem !important; }
    /* Plotlyチャート高さ調整 */
    .js-plotly-plot { max-height: 300px !important; }
    /* 見出し縮小 */
    h1 { font-size: 1.3rem !important; }
    h2 { font-size: 1.1rem !important; }
    h3, h4 { font-size: 1rem !important; }
}

/* ===== バナー（シグナル表示）===== */
.signal-bull {
    background: linear-gradient(135deg, #0d3318, #1a5c2e);
    border: 1px solid #2d8a4e;
    border-radius: 10px;
    padding: 14px 20px;
    text-align: center;
    font-size: 1.2rem;
    font-weight: 700;
    color: #4dff88;
}
.signal-bear {
    background: linear-gradient(135deg, #330d0d, #5c1a1a);
    border: 1px solid #8a2d2d;
    border-radius: 10px;
    padding: 14px 20px;
    text-align: center;
    font-size: 1.2rem;
    font-weight: 700;
    color: #ff6666;
}
.signal-neutral {
    background: linear-gradient(135deg, #1e1e2e, #2a2a3e);
    border: 1px solid #44446e;
    border-radius: 10px;
    padding: 14px 20px;
    text-align: center;
    font-size: 1.2rem;
    font-weight: 700;
    color: #aaaacc;
}
</style>
""",
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------------------
# Collector / DB import with mock fallback
# ---------------------------------------------------------------------------
try:
    from collector import collect_all
    from db import save_snapshot, get_latest, get_history

    MOCK_MODE = False
except ImportError:
    MOCK_MODE = True

# ---------------------------------------------------------------------------
# Number formatters
# ---------------------------------------------------------------------------

def fmt_price(v):
    return f"${v:,.2f}" if v is not None else "N/A"


def fmt_pct(v, decimals=4):
    if v is None:
        return "N/A"
    return f"{v * 100:+.{decimals}f}%"


def fmt_pct_raw(v, decimals=2):
    """v is already a percent (e.g. 58.27)"""
    if v is None:
        return "N/A"
    return f"{v:+.{decimals}f}%"


def fmt_billions(v):
    return f"${v / 1e9:.2f}B" if v is not None else "N/A"


def fmt_millions(v):
    return f"${v / 1e6:.1f}M" if v is not None else "N/A"


def fmt_int(v):
    return f"{int(v):,}" if v is not None else "N/A"


# ---------------------------------------------------------------------------
# Mock data generator
# ---------------------------------------------------------------------------
COINS = [
    "BTC", "ETH", "SOL", "XRP", "BNB",
    "DOGE", "ADA", "AVAX", "LINK", "DOT",
    "UNI", "MATIC", "ATOM", "LTC", "FIL",
]
EXCHANGES = [
    "binance", "bybit", "okx", "hyperliquid", "gate",
    "bitget", "mexc", "htx", "dydx", "bitmex", "bingx", "woox",
]
OI_EXCHANGES = ["binance", "bybit", "okx", "hyperliquid", "gate"]


def _rand_fr():
    """Random funding rate between -0.03 and 0.03"""
    return round(random.gauss(0, 0.006), 5)


def _make_mock_data(seed_offset: int = 0):
    random.seed(int(time.time() // 60) + seed_offset)
    now = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    # Funding rates
    funding_rates = {}
    fr_aggregate = {}
    for coin in COINS:
        rates = {ex: _rand_fr() for ex in EXCHANGES}
        funding_rates[coin] = rates
        vals = list(rates.values())
        fr_aggregate[coin] = {
            "avg": sum(vals) / len(vals),
            "max": max(vals),
            "min": min(vals),
            "spread": max(vals) - min(vals),
            "n_exchanges": len(vals),
        }

    # Open interest
    open_interest = {}
    oi_total = {}
    for coin in COINS:
        base_oi = random.uniform(50000, 400000)
        split = [random.uniform(0.1, 0.4) for _ in OI_EXCHANGES]
        total_split = sum(split)
        oi_dict = {}
        for i, ex in enumerate(OI_EXCHANGES):
            oi_coin = base_oi * split[i] / total_split
            price = 80700 if coin == "BTC" else random.uniform(10, 5000)
            oi_dict[ex] = {"oi_coin": round(oi_coin, 1), "oi_usd": round(oi_coin * price)}
        open_interest[coin] = oi_dict
        oi_total[coin] = {
            "total_coin": round(base_oi, 1),
            "total_usd": round(base_oi * (80700 if coin == "BTC" else 100)),
        }

    return {
        "timestamp": now,
        "btc_price": 80700.0 + random.gauss(0, 200),
        "btc_dominance": 58.27 + random.gauss(0, 0.1),
        "mempool": {
            "count": int(43367 + random.gauss(0, 500)),
            "vsize": 40000000,
            "fee_fast": 8,
            "fee_medium": 6,
        },
        "coinbase_premium_pct": round(random.gauss(-0.03, 0.05), 4),
        "funding_rates": funding_rates,
        "fr_aggregate": fr_aggregate,
        "open_interest": open_interest,
        "oi_total": oi_total,
        "vol": {
            "dvol": 38.6 + random.gauss(0, 0.5),
            "realized_vol": 29.2 + random.gauss(0, 0.3),
            "vrp": 9.4,
            "futures_premium_pct": -0.03,
            "pc_ratio": 1.67 + random.gauss(0, 0.02),
            "rr_7d": -3.1 + random.gauss(0, 0.1),
            "rr_14d": -4.2 + random.gauss(0, 0.1),
            "rr_30d": -6.5 + random.gauss(0, 0.1),
            "term_structure": {
                "7": 40.0,
                "14": 44.0,
                "30": 47.7,
                "60": 61.4,
                "90": 65.0,
            },
        },
        "stablecoins": {
            "usdt_usd": 189.6e9,
            "usdc_usd": 78.0e9,
            "usde_usd": 3.9e9,
            "total_usd": 320.6e9,
            "weekly_change_pct": 0.31,
        },
        "macro": {
            "spy": 737.62 + random.gauss(0, 2),
            "gld": 433.77 + random.gauss(0, 1),
            "oil": 95.42 + random.gauss(0, 0.5),
            "us10y": 4.36 + random.gauss(0, 0.02),
            "us02y": 3.92 + random.gauss(0, 0.02),
            "yield_spread": 0.44,
        },
        "etf_flow": {
            "latest_date": "2026-05-08",
            "daily_total_musd": -145.7 + random.gauss(0, 20),
            "cumulative_usd": 59340306704.0,
            "total_assets_usd": 106610918466.0,
            "tickers": {
                "IBIT": -27.2 + random.gauss(0, 5),
                "FBTC": -97.6 + random.gauss(0, 10),
                "GBTC": 0.0,
                "ARKB": -12.5 + random.gauss(0, 3),
                "BITB": -8.4 + random.gauss(0, 2),
            },
        },
        "exchange_flow": {
            "date": "2026-05-08",
            "inflow_usd": 1731e6 + random.gauss(0, 50e6),
            "outflow_usd": 2009e6 + random.gauss(0, 50e6),
            "net_usd": -278e6 + random.gauss(0, 30e6),
            "exchange_balance_btc": 2592000.0,
        },
        "polymarket": [
            {
                "question": "BTC above $100K by June 2026?",
                "yes_pct": 65.0,
                "volume": 4000000,
            },
            {
                "question": "BTC above $85K by end of May 2026?",
                "yes_pct": 48.3,
                "volume": 1200000,
            },
        ],
    }


def _make_mock_history(hours: int = 24):
    """Generate mock history as list of dicts"""
    now = time.time()
    records = []
    for i in range(hours * 4):  # 15-min intervals
        ts = now - (hours * 3600) + i * 900
        base_price = 80700 + 500 * math.sin(i / 20) + random.gauss(0, 100)
        base_dvol = 38.6 + 2 * math.sin(i / 15) + random.gauss(0, 0.3)
        base_fr = -0.003 + 0.002 * math.sin(i / 25) + random.gauss(0, 0.001)
        records.append(
            {
                "timestamp": ts,
                "btc_price": base_price,
                "dvol": base_dvol,
                "fr_avg_btc": base_fr,
                "etf_flow": random.gauss(-100, 80),
                "exchange_flow_net": random.gauss(-200, 150),
                "spy": 737.62 + random.gauss(0, 3),
            }
        )
    return records


# ---------------------------------------------------------------------------
# Data fetching with caching
# ---------------------------------------------------------------------------

def fetch_data():
    """Fetch data from collector or mock."""
    if MOCK_MODE:
        return _make_mock_data()
    try:
        loop = asyncio.new_event_loop()
        data = loop.run_until_complete(collect_all())
        loop.close()
        try:
            save_snapshot(data)
        except Exception:
            pass
        return data
    except Exception as e:
        st.warning(f"collector.py error: {e} — using mock data")
        return _make_mock_data()


def _normalize_history(records: list) -> list:
    """
    Normalize history records to a flat dict with:
      - timestamp: Unix float (for pd.to_datetime(..., unit='s'))
      - btc_price, dvol, fr_avg_btc, etf_flow, exchange_flow_net, spy
    Handles both mock flat format and live full-snapshot format from db.get_history().
    """
    flat = []
    for rec in records:
        if rec is None:
            continue
        # Determine Unix timestamp
        ts_raw = rec.get("timestamp")
        if ts_raw is None:
            continue
        if isinstance(ts_raw, (int, float)):
            ts_unix = float(ts_raw)
        else:
            # ISO string like "2026-05-10T00:00:00Z"
            try:
                import datetime as _dt
                s = str(ts_raw).replace("Z", "+00:00")
                ts_unix = _dt.datetime.fromisoformat(s).timestamp()
            except Exception:
                continue

        # Extract fields — handle nested full-snapshot or flat mock
        btc_price = rec.get("btc_price")
        dvol = rec.get("dvol") or rec.get("vol", {}).get("dvol")
        fr_avg_btc = (
            rec.get("fr_avg_btc")
            or (rec.get("fr_aggregate", {}).get("BTC", {}) or {}).get("avg")
        )
        etf_flow = (
            rec.get("etf_flow")
            if isinstance(rec.get("etf_flow"), (int, float))
            else (rec.get("etf_flow") or {}).get("daily_total_musd")
        )
        exflow_net = (
            rec.get("exchange_flow_net")
            if isinstance(rec.get("exchange_flow_net"), (int, float))
            else ((rec.get("exchange_flow") or {}).get("net_usd", None))
        )
        if isinstance(exflow_net, (int, float)) and exflow_net is not None:
            exflow_net = exflow_net / 1e6  # convert to $M for display consistency

        spy = rec.get("spy") or (rec.get("macro") or {}).get("spy")

        flat.append(
            {
                "timestamp": ts_unix,
                "btc_price": btc_price,
                "dvol": dvol,
                "fr_avg_btc": fr_avg_btc,
                "etf_flow": etf_flow,
                "exchange_flow_net": exflow_net,
                "spy": spy,
            }
        )
    return flat


def fetch_history(hours: int = 24):
    """Fetch historical records, normalized to flat format."""
    if MOCK_MODE:
        return _make_mock_history(hours)
    try:
        raw = get_history(hours)
        return _normalize_history(raw)
    except Exception:
        return _make_mock_history(hours)


# ---------------------------------------------------------------------------
# Sidebar: refresh settings
# ---------------------------------------------------------------------------
refresh_interval = st.sidebar.selectbox(
    "自動更新 (秒)", [30, 60, 120, 300], index=1
)
manual_refresh = st.sidebar.button("今すぐ更新")

if MOCK_MODE:
    st.sidebar.info("⚠️ MOCK MODE: collector.py / db.py が見つからないため模擬データを使用中")

# ---------------------------------------------------------------------------
# Session state: data caching
# ---------------------------------------------------------------------------
if (
    "last_fetch" not in st.session_state
    or manual_refresh
    or time.time() - st.session_state.get("last_fetch", 0) > refresh_interval
):
    with st.spinner("データ取得中..."):
        st.session_state.data = fetch_data()
        st.session_state.last_fetch = time.time()

data = st.session_state.data

# Show last-updated timestamp in sidebar
last_dt = datetime.datetime.fromtimestamp(st.session_state.last_fetch).strftime("%H:%M:%S")
st.sidebar.caption(f"最終更新: {last_dt}")
next_update = int(refresh_interval - (time.time() - st.session_state.last_fetch))
st.sidebar.caption(f"次回更新まで: {max(0, next_update)}秒")

# Polymarket section in sidebar
if data.get("polymarket"):
    st.sidebar.markdown("---")
    st.sidebar.markdown("**📊 Polymarket**")
    for item in data["polymarket"]:
        yes = item.get("yes_pct", 0)
        st.sidebar.markdown(
            f"**YES {yes:.1f}%** — {item['question'][:50]}…"
            if len(item["question"]) > 50
            else f"**YES {yes:.1f}%** — {item['question']}"
        )

# ---------------------------------------------------------------------------
# Tabs
# ---------------------------------------------------------------------------
tab1, tab2, tab3, tab4, tab5, tab6, tab7, tab8, tab9, tab10 = st.tabs(
    ["📊概要", "💰FR/OI", "📈ボラ", "🌊フロー", "🌐マクロ", "📜履歴", "💥清算",
     "📐テクニカル", "💣清算MAP", "📊変化率"]
)

# ==========================================================================
# TAB 1: Overview
# ==========================================================================
with tab1:
    st.markdown("### BTC Market Overview")

    try:
        # ---- ページヘッダー ---------------------------------------------------
        btc_price_h = data.get("btc_price") or 0
        tech_h = data.get("technical", {})
        sig_h  = tech_h.get("signal", "NEUTRAL")
        score_h = tech_h.get("composite_score", 0) or 0
        sig_css = "signal-bull" if sig_h=="BULL" else ("signal-bear" if sig_h=="BEAR" else "signal-neutral")
        sig_icon = "📈" if sig_h=="BULL" else ("📉" if sig_h=="BEAR" else "➡️")
        st.markdown(
            f'<div class="{sig_css}">{sig_icon} 総合シグナル: <b>{sig_h}</b> &nbsp;|&nbsp; '
            f'スコア {score_h:+.1f}/3.0 &nbsp;|&nbsp; BTC <b>${btc_price_h:,.0f}</b></div>',
            unsafe_allow_html=True
        )
        st.markdown("")

        # ---- Row 1+2: 2×4メトリクス（モバイル: 2列×4行、PC: 4列×2行）---------
        btc_price = data.get("btc_price")
        btc_dom   = data.get("btc_dominance")
        dvol      = data.get("vol", {}).get("dvol")
        realized  = data.get("vol", {}).get("realized_vol")
        vrp       = data.get("vol", {}).get("vrp")
        fr_btc_avg = data.get("fr_aggregate", {}).get("BTC", {}).get("avg")
        mempool   = data.get("mempool", {})
        cb_premium = data.get("coinbase_premium_pct")
        etf       = data.get("etf_flow", {})
        ex_flow   = data.get("exchange_flow", {})
        stbl      = data.get("stablecoins", {})
        liq_d     = data.get("liquidations", {})

        # 行1
        c1, c2, c3, c4 = st.columns(4)
        with c1:
            st.metric("₿ BTC価格", fmt_price(btc_price))
        with c2:
            st.metric("🌐 ドミナンス", f"{btc_dom:.2f}%" if btc_dom else "N/A")
        with c3:
            st.metric("📈 DVOL (≈BVX)", f"{dvol:.1f}" if dvol else "N/A",
                      delta=f"HV={realized:.1f}  VRP={vrp:+.1f}" if realized and vrp else None)
        with c4:
            fr_display = fmt_pct(fr_btc_avg) if fr_btc_avg is not None else "N/A"
            st.metric("💰 FR平均(BTC)", fr_display,
                      delta="🔴 ロング偏重" if (fr_btc_avg or 0)>0 else "🔵 ショート偏重")

        # 行2
        c5, c6, c7, c8 = st.columns(4)
        with c5:
            st.metric("⛓ Mempool TX", fmt_int(mempool.get("count")),
                      delta=f"手数料 {mempool.get('fee_fast','?')} sat/vB")
        with c6:
            st.metric("🏦 CB Premium", fmt_pct(cb_premium, 3))
        with c7:
            etf_daily = etf.get("daily_total_musd")
            st.metric("📦 ETF Flow (昨日)",
                      f"${etf_daily:+.1f}M" if etf_daily is not None else "N/A",
                      delta="流入 🟢" if (etf_daily or 0)>0 else "流出 🔴")
        with c8:
            net = ex_flow.get("net_usd")
            net_m = net/1e6 if net is not None else None
            st.metric("🔄 取引所Flow(net)",
                      f"${net_m:+.0f}M" if net_m is not None else "N/A",
                      delta="引出超 🟢" if (net or 0)<0 else "流入超 🔴")

    except Exception as e:
        st.error(f"Row 2 error: {e}")

    st.markdown("---")

    try:
        # ---- FR summary table for top 5 coins ---------------------------
        st.markdown("#### ファンディングレート概要（主要銘柄）")
        top_coins = ["BTC", "ETH", "SOL", "XRP", "BNB"]
        fr_agg = data.get("fr_aggregate", {})
        rows = []
        for coin in top_coins:
            agg = fr_agg.get(coin, {})
            rows.append(
                {
                    "銘柄": coin,
                    "平均 (%)": f"{agg.get('avg', 0) * 100:+.4f}",
                    "最大 (%)": f"{agg.get('max', 0) * 100:+.4f}",
                    "最小 (%)": f"{agg.get('min', 0) * 100:+.4f}",
                    "乖離幅 (%)": f"{agg.get('spread', 0) * 100:.4f}",
                    "取引所数": agg.get("n_exchanges", "-"),
                }
            )
        df_fr_summary = pd.DataFrame(rows)
        st.dataframe(df_fr_summary, use_container_width=True, hide_index=True)

    except Exception as e:
        st.error(f"FR summary error: {e}")

    try:
        # ---- BTC FR 24H history chart ------------------------------------
        st.markdown("#### BTC FR 推移（直近24時間）")
        hist = fetch_history(24)
        if hist:
            df_hist = pd.DataFrame(hist)
            if "fr_avg_btc" in df_hist.columns and "timestamp" in df_hist.columns:
                df_hist["dt"] = pd.to_datetime(df_hist["timestamp"], unit="s", utc=True)
                df_hist["fr_pct"] = df_hist["fr_avg_btc"] * 100

                fig = go.Figure()
                fig.add_trace(
                    go.Scatter(
                        x=df_hist["dt"],
                        y=df_hist["fr_pct"],
                        mode="lines",
                        name="FR avg BTC (%)",
                        line=dict(color="#4488ff", width=1.5),
                        fill="tozeroy",
                        fillcolor="rgba(68, 136, 255, 0.1)",
                    )
                )
                fig.add_hline(y=0, line_dash="dash", line_color="#666", line_width=1)
                fig.update_layout(
                    template="plotly_dark",
                    height=250,
                    margin=dict(l=0, r=0, t=20, b=20),
                    yaxis_title="FR (%)",
                    showlegend=False,
                )
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info("履歴データに fr_avg_btc カラムがありません")
        else:
            st.info("履歴データなし")

    except Exception as e:
        st.error(f"FR history chart error: {e}")

# ==========================================================================
# TAB 2: FR / OI
# ==========================================================================
with tab2:
    st.markdown("### Funding Rate / Open Interest")

    # ---- FR heatmap table ------------------------------------------------
    try:
        st.markdown("#### ファンディングレート ヒートマップ（全銘柄 × 全取引所）")

        fr_data = data.get("funding_rates", {})
        fr_agg = data.get("fr_aggregate", {})

        # Build DataFrame: rows = coins, cols = exchanges
        all_coins_fr = [c for c in COINS if c in fr_data]
        fr_rows = {}
        for coin in all_coins_fr:
            row = {}
            for ex in EXCHANGES:
                row[ex] = fr_data[coin].get(ex, None)
            agg = fr_agg.get(coin, {})
            row["avg"] = agg.get("avg")
            row["spread"] = agg.get("spread")
            fr_rows[coin] = row

        df_fr = pd.DataFrame(fr_rows).T  # coins as rows
        df_fr.index.name = "coin"

        # Convert to % for display
        df_fr_pct = df_fr.copy()
        for col in df_fr_pct.columns:
            df_fr_pct[col] = df_fr_pct[col].apply(
                lambda v: v * 100 if v is not None else None
            )

        def color_fr_cell(val):
            if pd.isna(val) or val is None:
                return "background: #2a2a2a; color: #555"
            if val > 1.0:
                return "background: #5c1a1a; color: #ff6666"
            if val > 0.3:
                return "background: #3d1515; color: #ff4444"
            if val > 0.05:
                return "background: #2d1010; color: #ff8888"
            if val < -1.0:
                return "background: #1a1a5c; color: #6666ff"
            if val < -0.3:
                return "background: #15153d; color: #4444ff"
            if val < -0.05:
                return "background: #10102d; color: #8888ff"
            return "background: #1e2130; color: #aaa"

        # Format for display (keep as %)
        df_display = df_fr_pct.copy()
        for col in df_display.columns:
            df_display[col] = df_display[col].apply(
                lambda v: f"{v:+.4f}" if v is not None and not (isinstance(v, float) and math.isnan(v)) else "—"
            )

        styled = (
            df_fr_pct.style
            .map(color_fr_cell)
            .format(lambda v: f"{v:+.4f}" if v is not None and not (isinstance(v, float) and math.isnan(v)) else "—")
        )
        st.dataframe(styled, use_container_width=True, height=520)

    except Exception as e:
        st.error(f"FR heatmap error: {e}")

    st.markdown("---")

    # ---- OI table --------------------------------------------------------
    try:
        st.markdown("#### Open Interest テーブル（BTC建て換算）")

        oi_data = data.get("open_interest", {})
        oi_total = data.get("oi_total", {})

        all_coins_oi = [c for c in COINS if c in oi_data]
        oi_rows = {}
        for coin in all_coins_oi:
            row = {}
            for ex in OI_EXCHANGES:
                ex_oi = oi_data[coin].get(ex, {})
                row[ex] = ex_oi.get("oi_coin", 0)
            tot = oi_total.get(coin, {})
            row["合計"] = tot.get("total_coin", 0)
            oi_rows[coin] = row

        df_oi = pd.DataFrame(oi_rows).T
        df_oi.index.name = "coin"

        # Format numbers
        df_oi_fmt = df_oi.copy()
        for col in df_oi_fmt.columns:
            df_oi_fmt[col] = df_oi_fmt[col].apply(lambda v: f"{v:,.0f}" if v else "—")

        st.dataframe(df_oi_fmt, use_container_width=True, height=400)

        # OI bar chart (top 8 coins by total)
        st.markdown("#### OI 合計 ランキング (コイン建て)")
        oi_totals = []
        for coin in all_coins_oi:
            tot = oi_total.get(coin, {}).get("total_coin", 0)
            oi_totals.append({"coin": coin, "total_coin": tot})

        df_oi_bar = pd.DataFrame(oi_totals).sort_values("total_coin", ascending=False).head(8)

        fig_oi = go.Figure(
            go.Bar(
                x=df_oi_bar["coin"],
                y=df_oi_bar["total_coin"],
                marker_color="#4488ff",
                text=df_oi_bar["total_coin"].apply(lambda v: f"{v:,.0f}"),
                textposition="outside",
            )
        )
        fig_oi.update_layout(
            template="plotly_dark",
            height=300,
            margin=dict(l=0, r=0, t=10, b=20),
            yaxis_title="OI (coin)",
            showlegend=False,
        )
        st.plotly_chart(fig_oi, use_container_width=True)

    except Exception as e:
        st.error(f"OI table error: {e}")

# ==========================================================================
# TAB 3: Volatility
# ==========================================================================
with tab3:
    st.markdown("### ボラティリティ / オプション市場")

    try:
        vol = data.get("vol", {})
        dvol = vol.get("dvol")
        hv = vol.get("realized_vol")
        vrp = vol.get("vrp")
        fp = vol.get("futures_premium_pct")
        pc = vol.get("pc_ratio")
        rr7 = vol.get("rr_7d")
        rr14 = vol.get("rr_14d")
        rr30 = vol.get("rr_30d")
        ts = vol.get("term_structure", {})

        col_left, col_right = st.columns([1, 2])

        with col_left:
            st.markdown("#### 主要指標")
            st.metric("DVOL (≈BVX)", f"{dvol:.1f}" if dvol else "N/A")
            st.metric("実現ボラ (HV)", f"{hv:.1f}" if hv else "N/A")

            vrp_delta = "IV > HV = 先物プレミアム過熱" if (vrp or 0) > 0 else "IV < HV"
            st.metric("VRP", f"{vrp:+.1f}pt" if vrp else "N/A", delta=vrp_delta)

            st.metric("先物プレミアム", fmt_pct(fp, 3))

            pc_delta = ">1 = Put優勢" if (pc or 0) > 1 else "<1 = Call優勢"
            st.metric("P/C Ratio", f"{pc:.2f}" if pc else "N/A", delta=pc_delta)

        with col_right:
            # Term structure chart
            if ts:
                st.markdown("#### インプライドボラ ターム構造")
                dtes = sorted(ts.keys(), key=lambda x: int(x))
                iv_vals = [ts[d] for d in dtes]
                fig_ts = go.Figure()
                fig_ts.add_trace(
                    go.Scatter(
                        x=[int(d) for d in dtes],
                        y=iv_vals,
                        mode="lines+markers",
                        name="IV (%)",
                        line=dict(color="#ffaa44", width=2),
                        marker=dict(size=8),
                    )
                )
                fig_ts.update_layout(
                    template="plotly_dark",
                    height=250,
                    margin=dict(l=0, r=0, t=10, b=20),
                    xaxis_title="DTE (days)",
                    yaxis_title="IV (%)",
                    showlegend=False,
                )
                st.plotly_chart(fig_ts, use_container_width=True)

            # Risk Reversal bar chart
            st.markdown("#### リスクリバーサル")
            rr_labels = ["7D", "14D", "30D"]
            rr_values = [rr7 or 0, rr14 or 0, rr30 or 0]
            colors = ["#ff4444" if v < 0 else "#44ff44" for v in rr_values]
            fig_rr = go.Figure(
                go.Bar(
                    x=rr_labels,
                    y=rr_values,
                    marker_color=colors,
                    text=[f"{v:+.1f}%" for v in rr_values],
                    textposition="outside",
                )
            )
            fig_rr.add_hline(y=0, line_dash="dash", line_color="#666", line_width=1)
            fig_rr.update_layout(
                template="plotly_dark",
                height=220,
                margin=dict(l=0, r=0, t=10, b=10),
                yaxis_title="RR (%)",
                showlegend=False,
            )
            st.plotly_chart(fig_rr, use_container_width=True)

    except Exception as e:
        st.error(f"Vol metrics error: {e}")

    st.markdown("---")

    # DVOL vs HV history chart
    try:
        st.markdown("#### DVOL vs 実現ボラ 推移（直近24H）")
        hist = fetch_history(24)
        if hist:
            df_hist = pd.DataFrame(hist)
            if "dvol" in df_hist.columns:
                df_hist["dt"] = pd.to_datetime(df_hist["timestamp"], unit="s", utc=True)

                fig_vol = make_subplots(specs=[[{"secondary_y": False}]])
                fig_vol.add_trace(
                    go.Scatter(
                        x=df_hist["dt"],
                        y=df_hist["dvol"],
                        name="DVOL",
                        line=dict(color="#ffaa44", width=1.5),
                    )
                )
                # Simulated HV (DVOL * 0.76 for mock)
                fig_vol.add_trace(
                    go.Scatter(
                        x=df_hist["dt"],
                        y=df_hist["dvol"] * 0.76,
                        name="実現ボラ (HV)",
                        line=dict(color="#44aaff", width=1.5, dash="dot"),
                    )
                )
                fig_vol.update_layout(
                    template="plotly_dark",
                    height=280,
                    margin=dict(l=0, r=0, t=10, b=20),
                    yaxis_title="Vol (%)",
                    legend=dict(orientation="h", y=1.02),
                )
                st.plotly_chart(fig_vol, use_container_width=True)
        else:
            st.info("履歴データなし")
    except Exception as e:
        st.error(f"Vol history chart error: {e}")

# ==========================================================================
# TAB 4: Flow
# ==========================================================================
with tab4:
    st.markdown("### フロー分析")

    col_etf, col_exflow = st.columns(2)

    # ---- ETF Flow --------------------------------------------------------
    with col_etf:
        st.markdown("#### ETF Flow")
        try:
            etf = data.get("etf_flow", {})
            daily = etf.get("daily_total_musd")
            cumul = etf.get("cumulative_usd")
            total_assets = etf.get("total_assets_usd")
            latest_date = etf.get("latest_date", "N/A")

            st.metric(
                f"ネットフロー ({latest_date})",
                f"${daily:+.1f}M" if daily is not None else "N/A",
                delta="流入超" if (daily or 0) > 0 else "流出超",
            )
            st.metric("累積純資産", fmt_billions(cumul))
            st.metric("ETF総資産", fmt_billions(total_assets))

            # Ticker bar chart
            tickers = etf.get("tickers", {})
            if tickers:
                tick_names = list(tickers.keys())
                tick_vals = list(tickers.values())
                colors_etf = ["#44ff44" if v > 0 else "#ff4444" for v in tick_vals]
                fig_etf = go.Figure(
                    go.Bar(
                        x=tick_names,
                        y=tick_vals,
                        marker_color=colors_etf,
                        text=[f"${v:+.1f}M" for v in tick_vals],
                        textposition="outside",
                    )
                )
                fig_etf.add_hline(y=0, line_dash="dash", line_color="#666", line_width=1)
                fig_etf.update_layout(
                    template="plotly_dark",
                    height=280,
                    margin=dict(l=0, r=0, t=10, b=20),
                    yaxis_title="Flow ($M)",
                    showlegend=False,
                )
                st.plotly_chart(fig_etf, use_container_width=True)
        except Exception as e:
            st.error(f"ETF flow error: {e}")

        # ETF 7D history
        try:
            st.markdown("**直近7日 ETF フロー推移**")
            hist7 = fetch_history(168)
            if hist7:
                df7 = pd.DataFrame(hist7)
                df7["dt"] = pd.to_datetime(df7["timestamp"], unit="s", utc=True)
                df7["date"] = df7["dt"].dt.date
                daily_agg = df7.groupby("date")["etf_flow"].mean().reset_index()

                colors_hist = ["#44ff44" if v > 0 else "#ff4444" for v in daily_agg["etf_flow"]]
                fig_etf7 = go.Figure(
                    go.Bar(
                        x=daily_agg["date"].astype(str),
                        y=daily_agg["etf_flow"],
                        marker_color=colors_hist,
                    )
                )
                fig_etf7.add_hline(y=0, line_dash="dash", line_color="#666")
                fig_etf7.update_layout(
                    template="plotly_dark",
                    height=200,
                    margin=dict(l=0, r=0, t=10, b=20),
                    yaxis_title="Flow ($M)",
                    showlegend=False,
                )
                st.plotly_chart(fig_etf7, use_container_width=True)
        except Exception as e:
            st.error(f"ETF history error: {e}")

    # ---- Exchange Flow ---------------------------------------------------
    with col_exflow:
        st.markdown("#### 取引所フロー (Coinmetrics)")
        try:
            exf = data.get("exchange_flow", {})
            inflow = exf.get("inflow_usd")
            outflow = exf.get("outflow_usd")
            net = exf.get("net_usd")
            bal = exf.get("exchange_balance_btc")

            flow_date = exf.get("date", "N/A")

            net_m = (net / 1e6) if net is not None else None
            net_label = "引出超 🟢 強気" if (net or 0) < 0 else "流入超 🔴 弱気"
            st.metric(f"ネットフロー ({flow_date})", fmt_millions(net), delta=net_label)
            st.metric("流入 (Inflow)", fmt_millions(inflow))
            st.metric("流出 (Outflow)", fmt_millions(outflow))
            st.metric("取引所BTC残高", f"{bal:,.0f} BTC" if bal else "N/A")

            # Flow indicator gauge
            if inflow and outflow and inflow > 0:
                ratio = outflow / inflow
                fig_gauge = go.Figure(
                    go.Indicator(
                        mode="gauge+number",
                        value=ratio,
                        title={"text": "出入比 (Out/In)"},
                        gauge={
                            "axis": {"range": [0.5, 1.5]},
                            "bar": {"color": "#4488ff"},
                            "steps": [
                                {"range": [0.5, 0.9], "color": "#4d1a1a"},
                                {"range": [0.9, 1.1], "color": "#2a2a2a"},
                                {"range": [1.1, 1.5], "color": "#1a4d1a"},
                            ],
                            "threshold": {
                                "line": {"color": "#fff", "width": 2},
                                "thickness": 0.75,
                                "value": 1.0,
                            },
                        },
                        number={"suffix": "x", "valueformat": ".2f"},
                    )
                )
                fig_gauge.update_layout(
                    template="plotly_dark",
                    height=250,
                    margin=dict(l=20, r=20, t=30, b=20),
                )
                st.plotly_chart(fig_gauge, use_container_width=True)
        except Exception as e:
            st.error(f"Exchange flow error: {e}")

    st.markdown("---")

    # ---- Stablecoins -------------------------------------------------------
    try:
        st.markdown("#### ステーブルコイン供給")
        sc = data.get("stablecoins", {})
        usdt = sc.get("usdt_usd")
        usdc = sc.get("usdc_usd")
        usde = sc.get("usde_usd")
        total_sc = sc.get("total_usd")
        wchg = sc.get("weekly_change_pct")

        cc1, cc2, cc3, cc4 = st.columns(4)
        cc1.metric("USDT", fmt_billions(usdt))
        cc2.metric("USDC", fmt_billions(usdc))
        cc3.metric("USDe", fmt_billions(usde))
        cc4.metric(
            "合計",
            fmt_billions(total_sc),
            delta=f"{wchg:+.2f}% 週次" if wchg is not None else None,
        )

        # Horizontal bar chart
        sc_labels = ["USDT", "USDC", "USDe"]
        sc_values = [(usdt or 0) / 1e9, (usdc or 0) / 1e9, (usde or 0) / 1e9]
        sc_colors = ["#26a17b", "#2775ca", "#6a1eff"]

        fig_sc = go.Figure(
            go.Bar(
                y=sc_labels,
                x=sc_values,
                orientation="h",
                marker_color=sc_colors,
                text=[f"${v:.1f}B" for v in sc_values],
                textposition="outside",
            )
        )
        fig_sc.update_layout(
            template="plotly_dark",
            height=200,
            margin=dict(l=0, r=60, t=10, b=20),
            xaxis_title="供給量 ($B)",
            showlegend=False,
        )
        st.plotly_chart(fig_sc, use_container_width=True)
    except Exception as e:
        st.error(f"Stablecoin error: {e}")

# ==========================================================================
# TAB 5: Macro
# ==========================================================================
with tab5:
    st.markdown("### マクロ経済指標")

    try:
        macro = data.get("macro", {})
        spy = macro.get("spy")
        gld = macro.get("gld")
        oil = macro.get("oil")
        us10y = macro.get("us10y")
        us02y = macro.get("us02y")
        ys = macro.get("yield_spread")

        mc1, mc2, mc3 = st.columns(3)
        with mc1:
            st.metric("S&P500 (SPY)", fmt_price(spy))
        with mc2:
            st.metric("Gold (GLD)", fmt_price(gld))
        with mc3:
            st.metric("原油 (CL)", fmt_price(oil))

        mc4, mc5, mc6 = st.columns(3)
        with mc4:
            st.metric("米10年金利", f"{us10y:.2f}%" if us10y else "N/A")
        with mc5:
            st.metric("米2年金利", f"{us02y:.2f}%" if us02y else "N/A")
        with mc6:
            ys_delta = "逆イールド" if (ys or 0) < 0 else "順イールド"
            st.metric(
                "イールドスプレッド (10y-2y)",
                f"{ys:+.2f}%" if ys else "N/A",
                delta=ys_delta,
            )

    except Exception as e:
        st.error(f"Macro metrics error: {e}")

    st.markdown("---")

    # BTC vs SPY correlation chart
    try:
        st.markdown("#### BTC vs SPY 推移（直近24H）")
        hist = fetch_history(24)
        if hist:
            df_macro = pd.DataFrame(hist)
            df_macro["dt"] = pd.to_datetime(df_macro["timestamp"], unit="s", utc=True)

            fig_macro = make_subplots(specs=[[{"secondary_y": True}]])
            fig_macro.add_trace(
                go.Scatter(
                    x=df_macro["dt"],
                    y=df_macro["btc_price"],
                    name="BTC Price",
                    line=dict(color="#f7931a", width=2),
                ),
                secondary_y=False,
            )
            if "spy" in df_macro.columns:
                fig_macro.add_trace(
                    go.Scatter(
                        x=df_macro["dt"],
                        y=df_macro["spy"],
                        name="SPY",
                        line=dict(color="#44aaff", width=1.5, dash="dot"),
                    ),
                    secondary_y=True,
                )
            fig_macro.update_layout(
                template="plotly_dark",
                height=320,
                margin=dict(l=0, r=0, t=10, b=20),
                legend=dict(orientation="h", y=1.02),
            )
            fig_macro.update_yaxes(title_text="BTC Price ($)", secondary_y=False)
            fig_macro.update_yaxes(title_text="SPY ($)", secondary_y=True)
            st.plotly_chart(fig_macro, use_container_width=True)
        else:
            st.info("履歴データなし")
    except Exception as e:
        st.error(f"Macro chart error: {e}")

    # Yield curve mini chart
    try:
        st.markdown("#### イールドカーブ (現在値)")
        maturities = ["2Y", "10Y"]
        yields = [us02y or 0, us10y or 0]
        spread_color = "#44ff44" if (ys or 0) > 0 else "#ff4444"
        fig_yc = go.Figure()
        fig_yc.add_trace(
            go.Scatter(
                x=maturities,
                y=yields,
                mode="lines+markers",
                line=dict(color=spread_color, width=2),
                marker=dict(size=10),
                fill="tozeroy",
                fillcolor=f"rgba(68, 255, 68, 0.1)" if (ys or 0) > 0 else "rgba(255, 68, 68, 0.1)",
            )
        )
        fig_yc.update_layout(
            template="plotly_dark",
            height=200,
            margin=dict(l=0, r=0, t=10, b=20),
            yaxis_title="Yield (%)",
            showlegend=False,
        )
        st.plotly_chart(fig_yc, use_container_width=True)
    except Exception as e:
        st.error(f"Yield curve error: {e}")

# ==========================================================================
# TAB 6: History
# ==========================================================================
with tab6:
    st.markdown("### 履歴チャート")

    try:
        # Metric selector
        metric_options = {
            "BTC価格": "btc_price",
            "DVOL": "dvol",
            "FR平均BTC": "fr_avg_btc",
            "ETF Flow ($M)": "etf_flow",
            "取引所Flow Net ($M)": "exchange_flow_net",
        }
        period_options = {"1H": 1, "6H": 6, "24H": 24, "7D": 168}

        col_sel1, col_sel2 = st.columns([2, 1])
        with col_sel1:
            selected_metric_label = st.selectbox("メトリクス", list(metric_options.keys()))
        with col_sel2:
            selected_period_label = st.selectbox("期間", list(period_options.keys()), index=2)

        selected_col = metric_options[selected_metric_label]
        selected_hours = period_options[selected_period_label]

        hist_data = fetch_history(selected_hours)

        if hist_data:
            df_h = pd.DataFrame(hist_data)
            df_h["dt"] = pd.to_datetime(df_h["timestamp"], unit="s", utc=True)

            if selected_col in df_h.columns:
                y_vals = df_h[selected_col]

                # Color based on metric direction
                line_color = "#f7931a"
                if selected_col == "fr_avg_btc":
                    line_color = "#4488ff"
                elif selected_col in ("etf_flow", "exchange_flow_net"):
                    line_color = "#44ff44"
                elif selected_col == "dvol":
                    line_color = "#ffaa44"

                fig_hist = go.Figure()

                # Determine if bar or line chart
                if selected_col in ("etf_flow", "exchange_flow_net"):
                    bar_colors = ["#44ff44" if v > 0 else "#ff4444" for v in y_vals]
                    fig_hist.add_trace(
                        go.Bar(
                            x=df_h["dt"],
                            y=y_vals,
                            marker_color=bar_colors,
                            name=selected_metric_label,
                        )
                    )
                    fig_hist.add_hline(y=0, line_dash="dash", line_color="#666")
                else:
                    fig_hist.add_trace(
                        go.Scatter(
                            x=df_h["dt"],
                            y=y_vals,
                            mode="lines",
                            name=selected_metric_label,
                            line=dict(color=line_color, width=1.5),
                            fill="tozeroy" if selected_col == "fr_avg_btc" else None,
                            fillcolor="rgba(68, 136, 255, 0.1)" if selected_col == "fr_avg_btc" else None,
                        )
                    )

                fig_hist.update_layout(
                    template="plotly_dark",
                    height=400,
                    margin=dict(l=0, r=0, t=20, b=20),
                    xaxis_title="時刻 (UTC)",
                    yaxis_title=selected_metric_label,
                    showlegend=False,
                    title=dict(
                        text=f"{selected_metric_label} — 直近{selected_period_label}",
                        x=0.5,
                    ),
                )
                st.plotly_chart(fig_hist, use_container_width=True)

                # Summary stats
                st.markdown("#### 統計サマリー")
                valid = y_vals.dropna()
                sc1, sc2, sc3, sc4 = st.columns(4)
                sc1.metric("最新値", f"{valid.iloc[-1]:.4f}" if len(valid) > 0 else "N/A")
                sc2.metric("平均", f"{valid.mean():.4f}" if len(valid) > 0 else "N/A")
                sc3.metric("最大", f"{valid.max():.4f}" if len(valid) > 0 else "N/A")
                sc4.metric("最小", f"{valid.min():.4f}" if len(valid) > 0 else "N/A")
            else:
                st.warning(f"カラム '{selected_col}' が履歴データに見つかりません")
        else:
            st.info("履歴データが取得できませんでした")

    except Exception as e:
        st.error(f"History chart error: {e}")

# ==========================================================================
# TAB 7: Liquidations
# ==========================================================================
with tab7:
    st.markdown("### 💥 清算データ / Long・Short比率")

    liq = data.get("liquidations", {})
    btc_px = data.get("btc_price") or 80000

    try:
        # ---- Row 1: OKX清算 + BitMEX件数 --------------------------------
        st.markdown("#### 取引所別 清算量（最新バッチ）")
        c1, c2, c3, c4 = st.columns(4)

        okx_long  = liq.get("okx_long_liq_btc")
        okx_short = liq.get("okx_short_liq_btc")
        bitmex_cnt = liq.get("bitmex_liq_count_1h")

        c1.metric("OKX ロング清算",
                  f"{okx_long:,.1f} BTC" if okx_long is not None else "N/A",
                  f"≈${okx_long*btc_px/1e6:.1f}M" if okx_long else None,
                  delta_color="inverse")
        c2.metric("OKX ショート清算",
                  f"{okx_short:,.1f} BTC" if okx_short is not None else "N/A",
                  f"≈${okx_short*btc_px/1e6:.1f}M" if okx_short else None)
        c3.metric("清算方向バランス",
                  ("ロング優勢" if (okx_long or 0) > (okx_short or 0) else "ショート優勢")
                  if okx_long is not None and okx_short is not None else "N/A")
        c4.metric("BitMEX 清算件数(最新バッチ)",
                  f"{bitmex_cnt} 件" if bitmex_cnt is not None else "N/A")

        st.divider()

        # ---- Row 2: Taker Buy/Sell比率 -----------------------------------
        st.markdown("#### Binance Taker Buy/Sell比率（1H）")
        st.caption("ratio > 1 = 買い超（強気） / ratio < 1 = 売り超（弱気）")

        taker = liq.get("bn_taker_ls", {})
        if taker:
            import pandas as pd
            rows = []
            for coin in ["BTC","ETH","SOL","XRP","BNB","DOGE","ADA","LINK","AVAX","DOT","LTC","UNI"]:
                t = taker.get(coin, {})
                if t:
                    rows.append({
                        "銘柄": coin,
                        "Buy出来高": f"{t.get('buy_vol',0):.1f}",
                        "Sell出来高": f"{t.get('sell_vol',0):.1f}",
                        "Buy/Sell比": round(t.get("ratio", 0), 4),
                        "方向": "🟢 買超" if t.get("ratio", 1) > 1 else "🔴 売超",
                    })
            if rows:
                df_taker = pd.DataFrame(rows)
                def color_ratio(val):
                    try:
                        v = float(val)
                        if v >= 1.2: return "background-color:#1a4d1a;color:#66ff66"
                        if v >= 1.05: return "background-color:#0d2d0d;color:#44cc44"
                        if v <= 0.8: return "background-color:#4d1a1a;color:#ff6666"
                        if v <= 0.95: return "background-color:#2d0d0d;color:#cc4444"
                        return "background-color:#1e2130;color:#aaa"
                    except:
                        return ""
                styled_taker = df_taker.style.map(color_ratio, subset=["Buy/Sell比"])
                st.dataframe(styled_taker, use_container_width=True, hide_index=True)

        st.divider()

        # ---- Row 3: アカウントL/S比率 ------------------------------------
        col_a, col_b = st.columns(2)

        with col_a:
            st.markdown("#### 全アカウント L/S比率（Binance）")
            acct = liq.get("bn_account_ls", {})
            if acct:
                rows2 = []
                for coin in ["BTC","ETH","SOL","XRP","BNB","DOGE","ADA","LINK","AVAX","DOT"]:
                    a = acct.get(coin, {})
                    if a:
                        rows2.append({
                            "銘柄": coin,
                            "Long%": f"{a.get('long',0)*100:.1f}%",
                            "Short%": f"{a.get('short',0)*100:.1f}%",
                            "L/S比": round(a.get("ratio", 0), 3),
                        })
                if rows2:
                    st.dataframe(pd.DataFrame(rows2), use_container_width=True, hide_index=True)

        with col_b:
            st.markdown("#### 上位トレーダー ポジションL/S（Binance）")
            top = liq.get("bn_top_ls", {})
            if top:
                rows3 = []
                for coin in ["BTC","ETH","SOL","XRP","BNB","DOGE","ADA","LINK","AVAX","DOT"]:
                    t2 = top.get(coin, {})
                    if t2:
                        rows3.append({
                            "銘柄": coin,
                            "Long%": f"{t2.get('long',0)*100:.1f}%",
                            "Short%": f"{t2.get('short',0)*100:.1f}%",
                            "L/S比": round(t2.get("ratio", 0), 3),
                        })
                if rows3:
                    st.dataframe(pd.DataFrame(rows3), use_container_width=True, hide_index=True)

        st.divider()

        # ---- Row 4: BTC L/S 詳細ゲージ ----------------------------------
        st.markdown("#### BTC ロング/ショート圧力サマリー")
        btc_taker = liq.get("bn_taker_ls", {}).get("BTC", {})
        btc_acct  = liq.get("bn_account_ls", {}).get("BTC", {})
        btc_top   = liq.get("bn_top_ls", {}).get("BTC", {})

        gc1, gc2, gc3 = st.columns(3)
        gc1.metric("Taker Buy/Sell (BTC)",
                   f"{btc_taker.get('ratio', 0):.4f}",
                   "買超" if btc_taker.get("ratio",1)>1 else "売超")
        gc2.metric("全口座 Long比率",
                   f"{btc_acct.get('long',0)*100:.1f}%",
                   f"S:{btc_acct.get('short',0)*100:.1f}%")
        gc3.metric("上位トレーダー Long比率",
                   f"{btc_top.get('long',0)*100:.1f}%",
                   f"S:{btc_top.get('short',0)*100:.1f}%")

        st.caption("データソース: OKX liquidation-orders / Binance futures/data API (無料)")

    except Exception as e:
        st.error(f"Liquidation tab error: {e}")

# ==========================================================================
# TAB 8: テクニカル分析
# ==========================================================================

# Mock data for technical (used when collector doesn't provide it)
MOCK_TECHNICAL = {
    "1h": {
        "price": 80700, "sma20": 80500, "sma75": 79000, "sma200": 76000,
        "rsi14": 55.3, "vs_sma20": "above", "vs_sma75": "above", "vs_sma200": "above",
        "sma20_dir": "up", "sma75_dir": "up", "sma200_dir": "up",
        "trend_score": 3, "candles": [],
    },
    "4h": {
        "price": 80700, "sma20": 80200, "sma75": 78500, "sma200": 73000,
        "rsi14": 58.1, "vs_sma20": "above", "vs_sma75": "above", "vs_sma200": "above",
        "sma20_dir": "up", "sma75_dir": "up", "sma200_dir": "up",
        "trend_score": 3, "candles": [],
    },
    "1d": {
        "price": 80700, "sma20": 79800, "sma75": 77000, "sma200": 69000,
        "rsi14": 62.4, "vs_sma20": "above", "vs_sma75": "above", "vs_sma200": "above",
        "sma20_dir": "up", "sma75_dir": "up", "sma200_dir": "up",
        "trend_score": 3, "candles": [],
    },
    "1w": {
        "price": 80700, "sma20": 78000, "sma75": 72000, "sma200": 58000,
        "rsi14": 67.8, "vs_sma20": "above", "vs_sma75": "above", "vs_sma200": "above",
        "sma20_dir": "up", "sma75_dir": "up", "sma200_dir": "up",
        "trend_score": 3, "candles": [],
    },
    "composite_score": 2.1,
    "signal": "BULL",
}

with tab8:
    st.markdown("### 📐 テクニカル分析")

    try:
        technical = data.get("technical") or MOCK_TECHNICAL
        if data.get("technical") is None:
            st.caption("⚠️ collector未実装のためモックデータを表示中")

        composite_score = technical.get("composite_score", 0) or 0
        signal = technical.get("signal", "NEUTRAL")

        # ---- 総合シグナル バナー ----------------------------------------
        if signal == "BULL":
            banner_color = "#1a4d1a"
            banner_text_color = "#66ff66"
            signal_icon = "📈"
        elif signal == "BEAR":
            banner_color = "#4d1a1a"
            banner_text_color = "#ff6666"
            signal_icon = "📉"
        else:
            banner_color = "#2a2a2a"
            banner_text_color = "#aaaaaa"
            signal_icon = "➡️"

        st.markdown(
            f"""
            <div style="background:{banner_color}; border-radius:8px; padding:18px 24px; margin-bottom:16px;">
                <span style="color:{banner_text_color}; font-size:1.4rem; font-weight:bold;">
                    {signal_icon} 総合シグナル: {signal} &nbsp;&nbsp; スコア: {composite_score:+.1f} / 3.0
                </span>
            </div>
            """,
            unsafe_allow_html=True,
        )

        # ---- SMAサマリーテーブル ----------------------------------------
        st.markdown("#### SMAサマリー（タイムフレーム別）")

        tf_labels = {"1h": "1H", "4h": "4H", "1d": "1D", "1w": "1W"}
        tf_rows = []
        for tf_key, tf_label in tf_labels.items():
            tf_data = technical.get(tf_key)
            if tf_data is None:
                continue
            price = tf_data.get("price", 0) or 0
            sma20 = tf_data.get("sma20", 0) or 0
            sma75 = tf_data.get("sma75", 0) or 0
            sma200 = tf_data.get("sma200", 0) or 0
            rsi14 = tf_data.get("rsi14")
            sma20_dir = tf_data.get("sma20_dir", "?")
            sma75_dir = tf_data.get("sma75_dir", "?")
            sma200_dir = tf_data.get("sma200_dir", "?")
            vs_sma20 = tf_data.get("vs_sma20", "below")
            vs_sma75 = tf_data.get("vs_sma75", "below")
            vs_sma200 = tf_data.get("vs_sma200", "below")
            trend_score = tf_data.get("trend_score", 0) or 0

            def _sma_cell(sma_val, vs, sma_dir):
                mark = "✅" if vs == "above" else "❌"
                arrow = "↑" if sma_dir == "up" else "↓"
                return f"${sma_val:,.0f} {arrow} {mark}"

            def _trend_arrows(score):
                if score >= 3:
                    return "▲▲▲"
                elif score == 2:
                    return "▲▲"
                elif score == 1:
                    return "▲"
                elif score == -1:
                    return "▼"
                elif score == -2:
                    return "▼▼"
                elif score <= -3:
                    return "▼▼▼"
                return "—"

            tf_rows.append({
                "時間足": tf_label,
                "現在価格": f"${price:,.0f}",
                "SMA20": _sma_cell(sma20, vs_sma20, sma20_dir),
                "SMA75": _sma_cell(sma75, vs_sma75, sma75_dir),
                "SMA200": _sma_cell(sma200, vs_sma200, sma200_dir),
                "RSI14": f"{rsi14:.1f}" if rsi14 is not None else "N/A",
                "トレンド": f"{_trend_arrows(trend_score)} {trend_score:+d}",
                "_vs20": vs_sma20,
                "_vs75": vs_sma75,
                "_vs200": vs_sma200,
            })

        if tf_rows:
            df_tech = pd.DataFrame(tf_rows)
            # vs_* columns are helpers for coloring only; hide them in display
            display_cols_tech = ["時間足", "現在価格", "SMA20", "SMA75", "SMA200", "RSI14", "トレンド"]
            hidden_cols_tech  = ["_vs20", "_vs75", "_vs200"]

            def color_tech_row(row):
                styles = [""] * len(row)
                cols = list(row.index)
                for col_name, vs_key in [("SMA20", "_vs20"), ("SMA75", "_vs75"), ("SMA200", "_vs200")]:
                    if col_name in cols and vs_key in cols:
                        idx = cols.index(col_name)
                        if row[vs_key] == "above":
                            styles[idx] = "background-color:#0d2d0d; color:#66ff66"
                        else:
                            styles[idx] = "background-color:#2d0d0d; color:#ff6666"
                return styles

            df_tech_all = df_tech[display_cols_tech + hidden_cols_tech]
            styled_tech = (
                df_tech_all.style
                .apply(color_tech_row, axis=1)
                .hide(axis="columns", subset=hidden_cols_tech)
            )
            st.dataframe(
                styled_tech,
                use_container_width=True,
                hide_index=True,
            )

        # ---- BTC 1H ローソク足チャート ----------------------------------
        st.markdown("#### BTC/USDT 1H — ローソク足 + SMA20/75/200")

        candles_1h = (technical.get("1h") or {}).get("candles", [])
        if candles_1h and len(candles_1h) > 0:
            try:
                import numpy as np
                candles_arr = candles_1h
                # dict形式 {'t','o','h','l','c','v'} とlist形式 [t,o,h,l,c,...] の両対応
                def _cv(c, key, idx):
                    return c[key] if isinstance(c, dict) else c[idx]
                timestamps_c = [datetime.datetime.fromtimestamp(_cv(c,'t',0)/1000, tz=datetime.timezone.utc) for c in candles_arr]
                opens_c  = [float(_cv(c,'o',1)) for c in candles_arr]
                highs_c  = [float(_cv(c,'h',2)) for c in candles_arr]
                lows_c   = [float(_cv(c,'l',3)) for c in candles_arr]
                closes_c = [float(_cv(c,'c',4)) for c in candles_arr]

                # Compute SMAs from closes
                def _rolling_sma(arr, n):
                    result = [None] * len(arr)
                    for i in range(n - 1, len(arr)):
                        result[i] = sum(arr[i - n + 1:i + 1]) / n
                    return result

                sma20_series  = _rolling_sma(closes_c, 20)
                sma75_series  = _rolling_sma(closes_c, 75)
                sma200_series = _rolling_sma(closes_c, 200)

                fig_candle = go.Figure()
                fig_candle.add_trace(go.Candlestick(
                    x=timestamps_c,
                    open=opens_c, high=highs_c, low=lows_c, close=closes_c,
                    name="BTC/USDT",
                    increasing_line_color="#26a69a",
                    decreasing_line_color="#ef5350",
                ))
                for sma_series, label, color in [
                    (sma20_series, "SMA20", "#2196F3"),
                    (sma75_series, "SMA75", "#FF9800"),
                    (sma200_series, "SMA200", "#F44336"),
                ]:
                    fig_candle.add_trace(go.Scatter(
                        x=timestamps_c, y=sma_series, name=label,
                        line=dict(color=color, width=1.5),
                        connectgaps=False,
                    ))
                fig_candle.update_layout(
                    template="plotly_dark", height=450,
                    xaxis_rangeslider_visible=False,
                    title="BTC/USDT 1H — SMA20/75/200",
                    margin=dict(l=0, r=0, t=40, b=20),
                )
                st.plotly_chart(fig_candle, use_container_width=True)
            except Exception as e_candle:
                st.warning(f"ローソク足チャート描画エラー: {e_candle}")
        else:
            st.info("ローソク足データ取得中… (collector.py が candles を返すと表示されます)")

    except Exception as e:
        st.error(f"テクニカル分析タブ エラー: {e}")

# ==========================================================================
# TAB 9: 清算マップ
# ==========================================================================

MOCK_LIQ_HEATMAP = {
    "okx_recent_liq": [
        {"price": 80615, "side": "short", "size_btc": 0.13, "time_ms": 1778370000000},
        {"price": 80782, "side": "long",  "size_btc": 1.72, "time_ms": 1778368800000},
        {"price": 80500, "side": "long",  "size_btc": 0.45, "time_ms": 1778367600000},
        {"price": 81100, "side": "short", "size_btc": 0.88, "time_ms": 1778366400000},
    ],
    "liq_levels": [
        {"price_level": 78000, "long_liq_btc": 80,  "short_liq_btc": 0},
        {"price_level": 78500, "long_liq_btc": 150, "short_liq_btc": 0},
        {"price_level": 79000, "long_liq_btc": 120, "short_liq_btc": 0},
        {"price_level": 79500, "long_liq_btc": 90,  "short_liq_btc": 0},
        {"price_level": 80000, "long_liq_btc": 40,  "short_liq_btc": 20},
        {"price_level": 80500, "long_liq_btc": 10,  "short_liq_btc": 60},
        {"price_level": 81000, "long_liq_btc": 0,   "short_liq_btc": 100},
        {"price_level": 81500, "long_liq_btc": 0,   "short_liq_btc": 150},
        {"price_level": 82000, "long_liq_btc": 0,   "short_liq_btc": 200},
        {"price_level": 83000, "long_liq_btc": 0,   "short_liq_btc": 180},
    ],
    "key_levels": {
        "major_long_liq_below": 78500,
        "major_short_liq_above": 83000,
        "next_long_liq": 79500,
        "next_short_liq": 81500,
    },
    "total_long_liq_est_usd": 50000000,
    "total_short_liq_est_usd": 30000000,
}

with tab9:
    st.markdown("### 💣 清算マップ")

    try:
        liq_heatmap = data.get("liq_heatmap") or MOCK_LIQ_HEATMAP
        if data.get("liq_heatmap") is None:
            st.caption("⚠️ collector未実装のためモックデータを表示中")

        btc_px9 = data.get("btc_price") or 80700
        key_levels = liq_heatmap.get("key_levels", {})
        total_long_usd  = liq_heatmap.get("total_long_liq_est_usd", 0) or 0
        total_short_usd = liq_heatmap.get("total_short_liq_est_usd", 0) or 0

        # ---- キー清算水準 ------------------------------------------------
        st.markdown("#### キー清算水準")
        kc1, kc2, kc3, kc4 = st.columns(4)
        with kc1:
            v = key_levels.get("major_long_liq_below")
            st.metric("ロング最大清算↓", f"${v:,.0f}" if v else "N/A",
                      delta=f"{(v - btc_px9):+,.0f}" if v else None,
                      delta_color="inverse")
        with kc2:
            v = key_levels.get("next_long_liq")
            st.metric("ロング次点↓", f"${v:,.0f}" if v else "N/A",
                      delta=f"{(v - btc_px9):+,.0f}" if v else None,
                      delta_color="inverse")
        with kc3:
            v = key_levels.get("next_short_liq")
            st.metric("ショート次点↑", f"${v:,.0f}" if v else "N/A",
                      delta=f"{(v - btc_px9):+,.0f}" if v else None)
        with kc4:
            v = key_levels.get("major_short_liq_above")
            st.metric("ショート最大清算↑", f"${v:,.0f}" if v else "N/A",
                      delta=f"{(v - btc_px9):+,.0f}" if v else None)

        kc5, kc6 = st.columns(2)
        with kc5:
            st.metric("推定ロング清算総額",
                      f"${total_long_usd / 1e6:.1f}M" if total_long_usd else "N/A",
                      delta_color="inverse")
        with kc6:
            st.metric("推定ショート清算総額",
                      f"${total_short_usd / 1e6:.1f}M" if total_short_usd else "N/A")

        st.markdown("---")

        # ---- 清算水準ヒートマップ ----------------------------------------
        st.markdown("#### 清算水準マップ（推定 BTC量）")
        liq_levels = liq_heatmap.get("liq_levels", [])
        if liq_levels:
            liq_levels_sorted = sorted(liq_levels, key=lambda x: x["price_level"])
            price_labels = [f"${l['price_level']:,.0f}" for l in liq_levels_sorted]
            long_vals  = [-l.get("long_liq_btc", 0) for l in liq_levels_sorted]   # 左向き (負)
            short_vals = [l.get("short_liq_btc", 0)  for l in liq_levels_sorted]   # 右向き (正)

            fig_liq = go.Figure()
            fig_liq.add_trace(go.Bar(
                y=price_labels,
                x=long_vals,
                orientation='h',
                name="ロング清算",
                marker_color="rgba(255,68,68,0.7)",
            ))
            fig_liq.add_trace(go.Bar(
                y=price_labels,
                x=short_vals,
                orientation='h',
                name="ショート清算",
                marker_color="rgba(68,255,68,0.7)",
            ))

            # 現在価格ライン (y軸は文字列なのでannotationで表現)
            current_label = f"${btc_px9:,.0f}"
            if current_label not in price_labels and price_labels:
                pass  # 近い価格をannotationで示す

            fig_liq.update_layout(
                template="plotly_dark",
                barmode="overlay",
                height=500,
                title=f"清算水準マップ（現在価格: ${btc_px9:,.0f}）",
                xaxis_title="BTC 清算量 (ロング←  →ショート)",
                margin=dict(l=0, r=0, t=40, b=20),
                legend=dict(orientation="h", y=1.05),
            )
            st.plotly_chart(fig_liq, use_container_width=True)
        else:
            st.info("清算水準データなし")

        st.markdown("---")

        # ---- OKX 直近清算イベント テーブル --------------------------------
        st.markdown("#### OKX 直近清算イベント")
        recent_liq = liq_heatmap.get("okx_recent_liq", [])
        if recent_liq:
            liq_rows = []
            for ev in recent_liq:
                ts_ms = ev.get("time_ms", 0)
                ts_str = datetime.datetime.fromtimestamp(
                    ts_ms / 1000, tz=datetime.timezone.utc
                ).strftime("%Y-%m-%d %H:%M") if ts_ms else "N/A"
                price_ev = ev.get("price", 0) or 0
                size_btc = ev.get("size_btc", 0) or 0
                side = ev.get("side", "")
                side_label = "🟢 ショート清算" if side == "short" else "🔴 ロング清算"
                usd_est = price_ev * size_btc
                liq_rows.append({
                    "時刻 (UTC)": ts_str,
                    "サイド": side_label,
                    "清算価格": f"${price_ev:,.0f}",
                    "サイズ (BTC)": f"{size_btc:.2f}",
                    "推定USD": f"${usd_est:,.0f}",
                    "_side": side,
                })

            df_recent = pd.DataFrame(liq_rows)

            def color_liq_side(row):
                styles = [""] * len(row)
                cols = list(row.index)
                side_val = row.get("_side", "")
                if "サイド" in cols:
                    idx = cols.index("サイド")
                    if side_val == "short":
                        styles[idx] = "color:#66ff66"
                    else:
                        styles[idx] = "color:#ff6666"
                return styles

            display_cols_liq = ["時刻 (UTC)", "サイド", "清算価格", "サイズ (BTC)", "推定USD"]
            df_recent_display = df_recent[display_cols_liq + ["_side"]]
            styled_liq = (
                df_recent_display.style
                .apply(color_liq_side, axis=1)
                .hide(axis="columns", subset=["_side"])
            )
            st.dataframe(styled_liq, use_container_width=True, hide_index=True)
        else:
            st.info("直近清算データなし")

    except Exception as e:
        st.error(f"清算マップタブ エラー: {e}")

# ==========================================================================
# TAB 10: 変化率
# ==========================================================================

MOCK_CHANGES = {
    "btc_price": {
        "label": "BTC価格",
        "now": 80700, "unit": "$", "format": "price",
        "24h_ago": 79500, "7d_ago": 77000, "30d_ago": 72000,
        "chg_24h": +1.51, "chg_7d": +4.81, "chg_30d": +12.08,
    },
    "btc_dominance": {
        "label": "BTCドミナンス",
        "now": 58.27, "unit": "%", "format": "pct_raw",
        "chg_24h": +0.1, "chg_7d": -0.5, "chg_30d": +2.1,
    },
    "dvol": {
        "label": "DVOL (≒BVX)",
        "now": 38.6, "unit": "", "format": "float1",
        "chg_24h": -1.2, "chg_7d": +3.4, "chg_30d": -5.6,
    },
    "fr_avg_btc": {
        "label": "BTC FR平均",
        "now": -0.003, "unit": "%", "format": "fr",
        "chg_24h": None, "chg_7d": None, "chg_30d": None,
    },
    "etf_daily": {
        "label": "ETF日次フロー",
        "now": -145.7, "unit": "$M", "format": "flow_m",
        "chg_24h": -291.4, "chg_7d": None, "chg_30d": None,
    },
    "exchange_flow_net": {
        "label": "取引所Flow(net)",
        "now": -278.0, "unit": "$M", "format": "flow_m",
        "chg_24h": +88.0, "chg_7d": None, "chg_30d": None,
    },
    "stablecoin_total": {
        "label": "ステーブル総供給",
        "now": 320.6e9, "unit": "$B", "format": "billions",
        "chg_24h": +0.1e9, "chg_7d": +1.5e9, "chg_30d": +8.2e9,
    },
    "mempool_count": {
        "label": "Mempool TX数",
        "now": 43367, "unit": "件", "format": "int",
        "chg_24h": -8615, "chg_7d": None, "chg_30d": None,
    },
    "oi_total_btc": {
        "label": "BTC OI合計",
        "now": 277000, "unit": "BTC", "format": "int",
        "chg_24h": +1200, "chg_7d": None, "chg_30d": None,
    },
    "coinbase_premium": {
        "label": "Coinbase Premium",
        "now": -0.029, "unit": "%", "format": "fr",
        "chg_24h": -0.04, "chg_7d": None, "chg_30d": None,
    },
}

with tab10:
    st.markdown("### 📊 変化率（前日/前週/前月比）")

    try:
        changes = data.get("changes") or MOCK_CHANGES
        if data.get("changes") is None:
            st.caption("⚠️ collector未実装のためモックデータを表示中")

        # ---- 変化率テーブル -----------------------------------------------
        st.markdown("#### 全メトリクス 変化率テーブル")

        def _fmt_now(entry):
            fmt = entry.get("format", "float1")
            val = entry.get("now")
            if val is None:
                return "N/A"
            if fmt == "price":
                return f"${val:,.0f}"
            elif fmt == "pct_raw":
                return f"{val:.2f}%"
            elif fmt == "fr":
                return f"{val * 100:+.4f}%"
            elif fmt == "flow_m":
                return f"${val:+.1f}M"
            elif fmt == "billions":
                return f"${val / 1e9:.1f}B"
            elif fmt == "int":
                return f"{int(val):,}"
            else:
                return f"{val:.2f}"

        def _fmt_chg(val, suffix=""):
            if val is None:
                return "N/A"
            if val > 0:
                return f"+{val:.2f}{suffix} ↑"
            elif val < 0:
                return f"{val:.2f}{suffix} ↓"
            else:
                return f"{val:.2f}{suffix} →"

        def _chg_color(val):
            if val is None or val == 0:
                return "color:#888888"
            return "color:#66ff66" if val > 0 else "color:#ff6666"

        chg_rows = []
        for key, entry in changes.items():
            chg_rows.append({
                "データ": entry.get("label", key),
                "現在値": _fmt_now(entry),
                "前日比": _fmt_chg(entry.get("chg_24h")),
                "前週比": _fmt_chg(entry.get("chg_7d")),
                "前月比": _fmt_chg(entry.get("chg_30d")),
                "_c24h": entry.get("chg_24h"),
                "_c7d": entry.get("chg_7d"),
                "_c30d": entry.get("chg_30d"),
            })

        df_chg = pd.DataFrame(chg_rows)

        def color_chg_row(row):
            styles = [""] * len(row)
            cols = list(row.index)
            for col_name, src_key in [("前日比", "_c24h"), ("前週比", "_c7d"), ("前月比", "_c30d")]:
                if col_name in cols and src_key in cols:
                    idx = cols.index(col_name)
                    v = row[src_key]
                    if v is None:
                        styles[idx] = "color:#555555"
                    elif v > 0:
                        styles[idx] = "color:#66ff66"
                    elif v < 0:
                        styles[idx] = "color:#ff6666"
                    else:
                        styles[idx] = "color:#888888"
            return styles

        display_cols_chg = ["データ", "現在値", "前日比", "前週比", "前月比"]
        hidden_cols_chg  = ["_c24h", "_c7d", "_c30d"]
        df_chg_full = df_chg[display_cols_chg + hidden_cols_chg]
        styled_chg = (
            df_chg_full.style
            .apply(color_chg_row, axis=1)
            .hide(axis="columns", subset=hidden_cols_chg)
        )
        st.dataframe(styled_chg, use_container_width=True, hide_index=True)

        st.markdown("---")

        # ---- 変化率ヒートマップ（横棒） -----------------------------------
        st.markdown("#### 変化率 ヒートマップ")

        period_sel = st.selectbox(
            "期間選択",
            ["前日比 (24h)", "前週比 (7d)", "前月比 (30d)"],
            key="chg_period_sel",
        )
        period_key_map = {
            "前日比 (24h)": "chg_24h",
            "前週比 (7d)": "chg_7d",
            "前月比 (30d)": "chg_30d",
        }
        chg_key = period_key_map[period_sel]

        chg_labels = []
        chg_values = []
        for key, entry in changes.items():
            v = entry.get(chg_key)
            if v is not None:
                chg_labels.append(entry.get("label", key))
                chg_values.append(v)

        if chg_labels:
            bar_colors_chg = ["#26a69a" if v > 0 else "#ef5350" for v in chg_values]
            fig_chg = go.Figure()
            fig_chg.add_trace(go.Bar(
                name=period_sel,
                x=chg_values,
                y=chg_labels,
                orientation='h',
                marker_color=bar_colors_chg,
                text=[f"{v:+.2f}" for v in chg_values],
                textposition="outside",
            ))
            fig_chg.add_vline(x=0, line_dash="dash", line_color="#666", line_width=1)
            fig_chg.update_layout(
                template="plotly_dark",
                height=400,
                margin=dict(l=0, r=60, t=20, b=20),
                xaxis_title="変化量",
                showlegend=False,
                title=f"{period_sel} 変化率ヒートマップ",
            )
            st.plotly_chart(fig_chg, use_container_width=True)
        else:
            st.info(f"{period_sel} のデータがありません")

    except Exception as e:
        st.error(f"変化率タブ エラー: {e}")

# ---------------------------------------------------------------------------
# Auto-refresh (at bottom, after all content is rendered)
# ---------------------------------------------------------------------------
time.sleep(refresh_interval)
st.rerun()
