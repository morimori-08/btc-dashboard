"""
onchain.py — Load on-chain DAILY features with strict shift(1) discipline.

DATA SOURCE (see report for the network caveat):
  The task specified live DeFiLlama / CoinGecko endpoints, but network egress
  is blocked in this environment (Bash network denied; WebFetch truncates &
  summarises large JSON arrays => unusable for a numeric time series).
  The ONLY on-chain daily series available locally as a *verified, complete*
  cache is total stablecoin USD supply:
      /Users/.../BTC_BOT/backtest_cache/stablecoin_supply_daily.csv
      columns: timestamp,sc_supply,sc_supply_7d_chg   (daily, 2018-10-17..2026-05-09)
      sc_supply == DeFiLlama totalCirculatingUSD.peggedUSD (scale verified:
      137B on 2023-01-01 -> 322B on 2026-05-09, matches all-stablecoins mcap).

  NOT AVAILABLE OFFLINE (cannot be fetched => features are BLOCKED, not tested):
    - DeFi TVL (historicalChainTvl)           -> tvl_d1w_pct      (H2)
    - Ethereum/Tron stablecoin chain split    -> eth_tron_ratio   (H4 sub)
    - BTC daily price                         -> btc_weekend_ret  (H3)
  These are reported as BLOCKED in the final verdict, never as REJECT,
  because absence of data is not evidence against an edge.

FEATURES (computed here, then shift(1) applied IN THE HARNESS, not here):
  We expose raw, point-in-time daily levels only. The harness is responsible
  for the .shift(1) so that only PRIOR-day-confirmed on-chain values can
  inform the NEXT FX day. To make that contract explicit and safe, every
  function below returns a level/return indexed by the date on which the
  value is *known at end of that UTC day*. The harness shifts it forward.

  sc_supply        : level
  sc_d1w_pct       : 7d  pct change of sc_supply  = supply/supply.shift(7)-1
  sc_d4w_pct       : 28d pct change of sc_supply  = supply/supply.shift(28)-1

  NOTE: these % changes use ONLY past supply values relative to date t
  (t vs t-7, t vs t-28). They are known at end of day t. The harness then
  shift(1)s the whole feature so the FX trade on day t+1 sees the value as
  of day t. No current-or-future leakage.
"""
import os
import pandas as pd

SC_CACHE = "/Users/morimori/Desktop/トレーディング/BTC_BOT/backtest_cache/stablecoin_supply_daily.csv"

# --- 2026-06-27: previously-BLOCKED on-chain series, now fetched to local CSV ---
# (main session fetched these; all daily, contiguous, through 2026-06; verified:
#  no NaNs, no dup dates, 0 non-1-day steps, scales sanity-checked.)
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
TVL_CSV     = os.path.join(DATA_DIR, "defi_tvl_daily.csv")      # date, tvl_usd
ETH_SC_CSV  = os.path.join(DATA_DIR, "ethereum_sc_daily.csv")   # date, sc_peggedUSD
TRON_SC_CSV = os.path.join(DATA_DIR, "tron_sc_daily.csv")       # date, sc_peggedUSD
BTC_CSV     = os.path.join(DATA_DIR, "btc_daily.csv")           # date, btc_close


def _read_daily(path, col):
    """Read a (date,<col>) daily CSV into a tz-naive, day-normalized Series."""
    df = pd.read_csv(path)
    df["date"] = pd.to_datetime(df["date"]).dt.normalize()
    df = df.set_index("date").sort_index()
    return df[col].astype(float)


def load_stablecoin():
    df = pd.read_csv(SC_CACHE)
    df["date"] = pd.to_datetime(df["timestamp"]).dt.normalize()
    df = df.set_index("date").sort_index()
    s = df["sc_supply"].astype(float)
    # Re-derive % changes ourselves from the raw level (do NOT trust the
    # precomputed sc_supply_7d_chg column). Calendar-day spacing is verified
    # contiguous (0 non-1-day steps), so .shift(7)/.shift(28) == 7/28 days.
    out = pd.DataFrame(index=s.index)
    out["sc_supply"] = s
    out["sc_d1w_pct"] = (s / s.shift(7) - 1.0) * 100.0
    out["sc_d4w_pct"] = (s / s.shift(28) - 1.0) * 100.0
    return out


def load_tvl():
    """H2: total DeFi TVL. Feature tvl_d1w_pct = 7d pct change of TVL.
    Value indexed by the date it is KNOWN AT END of (point-in-time); the
    harness applies .shift(1) so the FX trade on day t+1 sees the day-t value.
    7d window uses ONLY t vs t-7 (contiguous daily verified) => no leakage."""
    s = _read_daily(TVL_CSV, "tvl_usd")
    out = pd.DataFrame(index=s.index)
    out["tvl_usd"] = s
    out["tvl_d1w_pct"] = (s / s.shift(7) - 1.0) * 100.0
    return out


def load_chainsplit():
    """H4-split: eth_tron_ratio = ethereum_sc / tron_sc, and ratio_d1w = its 7d
    pct change. Both indexed by the date they are KNOWN AT END of; harness
    .shift(1)s them. The ratio uses same-day eth & tron levels (both confirmed
    at end of that UTC day) => no leakage; ratio_d1w uses t vs t-7 only."""
    eth = _read_daily(ETH_SC_CSV, "sc_peggedUSD")
    tron = _read_daily(TRON_SC_CSV, "sc_peggedUSD")
    # align on the intersection of available dates (both contiguous daily)
    idx = eth.index.intersection(tron.index)
    eth, tron = eth.reindex(idx), tron.reindex(idx)
    ratio = eth / tron
    out = pd.DataFrame(index=idx)
    out["eth_tron_ratio"] = ratio
    out["ratio_d1w"] = (ratio / ratio.shift(7) - 1.0) * 100.0
    return out


def load_btc_daily():
    """Raw BTC daily close (UTC). Used ONLY by the harness's bespoke H3 builder,
    which computes the Friday-close -> Sunday-close weekend return and attaches
    it to the FOLLOWING Monday (known before the FX Monday 00:00 UTC open).
    Returned as a plain level series so the H3 timing lives in one place."""
    return _read_daily(BTC_CSV, "btc_close")


# Features that ARE available offline and flow through the GENERIC shift(1)
# next-day harness path (build_panel in run_backtest.py).
#   sc_*  : H1/H4/H4b  (stablecoin supply, prior run)
#   tvl_d1w_pct        : H2
#   eth_tron_ratio, ratio_d1w : H4-split
# btc_weekend_return_pct is NOT here: it is a Monday-only signal with bespoke
# timing, built by build_panel_h3() in the harness (not the generic shift(1)).
AVAILABLE_FEATURES = [
    "sc_d1w_pct", "sc_d4w_pct",
    "tvl_d1w_pct",
    "eth_tron_ratio", "ratio_d1w",
]
# Features specified by the task that remain unavailable. (As of 2026-06-27 the
# DeFi-TVL / chain-split / BTC-price series were fetched locally, so they are no
# longer blocked; this dict now documents what was unblocked.)
BLOCKED_FEATURES = {}
UNBLOCKED_2026_06_27 = {
    "tvl_d1w_pct":   "DeFi TVL fetched to data/defi_tvl_daily.csv",
    "eth_tron_ratio": "ETH/Tron stablecoin split fetched to data/{ethereum,tron}_sc_daily.csv",
    "ratio_d1w":     "7d change of eth_tron_ratio (from the above)",
    "btc_weekend_return_pct": "BTC daily close fetched to data/btc_daily.csv (H3, Monday-only)",
}


def load_features():
    """Return the on-chain daily feature frame for the GENERIC shift(1) path.
    Joins stablecoin supply, DeFi TVL, and chain-split features on a unified
    daily index (outer join; warmup NaNs are dropped downstream per-feature)."""
    sc = load_stablecoin()
    tvl = load_tvl()
    split = load_chainsplit()
    # outer-join on the union of daily dates; each feature keeps its own NaNs
    # in the warmup region and the harness drops rows lacking the active feature.
    out = sc.join(tvl, how="outer").join(split, how="outer").sort_index()
    return out


if __name__ == "__main__":
    f = load_features()
    print("onchain feature frame:", f.shape, f.index.min().date(), "->", f.index.max().date())
    cols = ["sc_d1w_pct", "sc_d4w_pct", "tvl_d1w_pct", "eth_tron_ratio", "ratio_d1w"]
    sub = f[(f.index >= "2023-01-01")][cols].dropna()
    print("rows >=2023 (all feats non-NaN):", len(sub))
    print(sub.describe().round(3).to_string())
    btc = load_btc_daily()
    print("\nBTC daily:", btc.shape, btc.index.min().date(), "->", btc.index.max().date())
