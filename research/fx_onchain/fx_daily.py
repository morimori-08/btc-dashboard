"""
fx_daily.py — Resample 5-min FX CSVs to DAILY UTC OHLC.

NO-LOOKAHEAD / DATA-HYGIENE NOTES:
- We resample on the UTC *calendar day* (floor of the 5-min timestamp to day).
- A daily bar's OPEN  = first 5-min open of that UTC day.
- A daily bar's CLOSE = last  5-min close of that UTC day.
- A daily bar's HIGH/LOW = max high / min low over the day.
- Weekend days with no FX ticks simply do not appear (dropna on open).
- For the Monday-gap test we additionally expose, per ISO week:
      fri_close = last close of the week's Friday (UTC)
      mon_open  = first open of the FOLLOWING Monday (UTC)
  These are computed from the daily frame only (no intraday leakage).

This module ONLY builds price frames. It does not compute any signal,
so it cannot introduce signal-side lookahead. Signal timing lives in
the backtest harness (run_backtest.py).
"""
import os
import pandas as pd

PRIMARY = {
    "USDJPY": "/Users/morimori/Desktop/トレーディング/FX_BOT/バックテスト_6ペア_5分足/USDJPY_5min.csv",
    "EURJPY": "/Users/morimori/Desktop/トレーディング/FX_BOT/バックテスト_6ペア_5分足/EURJPY_5min.csv",
    "EURUSD": "/Users/morimori/Desktop/トレーディング/FX_BOT/バックテスト_6ペア_5分足/EURUSD_5min.csv",
}
# Per-year dukascopy fallback/extension (USDJPY has none).
DUKAS_DIR = "/Users/morimori/dukascopy_data"
DUKAS_PAIRS = ("EURJPY", "EURUSD")
DUKAS_YEARS = range(2018, 2027)

# pip size per pair (price units) for cost modelling
PIP = {"USDJPY": 0.01, "EURJPY": 0.01, "EURUSD": 0.0001}


def _read_5min(path):
    df = pd.read_csv(path)
    # time column is 'time' (USDJPY primary) or 'timestamp' (others)
    tcol = "time" if "time" in df.columns else "timestamp"
    ts = pd.to_datetime(df[tcol], utc=True, errors="coerce")
    df = df.assign(ts=ts).dropna(subset=["ts"])
    df = df[["ts", "open", "high", "low", "close"]]
    return df


def load_5min(pair):
    frames = [_read_5min(PRIMARY[pair])]
    if pair in DUKAS_PAIRS:
        for y in DUKAS_YEARS:
            p = os.path.join(DUKAS_DIR, f"{pair}_5min_{y}.csv")
            if os.path.exists(p):
                frames.append(_read_5min(p))
    df = pd.concat(frames, ignore_index=True)
    # Deduplicate overlapping timestamps (primary + dukascopy may overlap).
    # Keep first occurrence (primary listed first). Sort by time.
    df = df.sort_values("ts").drop_duplicates(subset="ts", keep="first")
    return df


def to_daily(pair):
    """Return daily OHLC DataFrame indexed by UTC date (datetime64, tz-naive day)."""
    df = load_5min(pair)
    df = df.set_index("ts").sort_index()
    # Resample to calendar day on UTC.
    daily = pd.DataFrame({
        "open":  df["open"].resample("1D").first(),
        "high":  df["high"].resample("1D").max(),
        "low":   df["low"].resample("1D").min(),
        "close": df["close"].resample("1D").last(),
        "n5m":   df["close"].resample("1D").count(),
    })
    # Drop days with no ticks (weekends/holidays). open NaN => no data.
    daily = daily.dropna(subset=["open"]).copy()
    # Require a minimal number of 5-min bars so a near-empty day isn't a "bar".
    daily = daily[daily["n5m"] >= 12]  # >=1h of data
    # Index -> tz-naive date for clean joins with on-chain daily dates.
    daily.index = daily.index.tz_convert("UTC").tz_localize(None).normalize()
    daily.index.name = "date"
    # next-day-return building blocks
    daily["dow"] = daily.index.dayofweek  # 0=Mon .. 6=Sun
    return daily


if __name__ == "__main__":
    for p in ("USDJPY", "EURJPY", "EURUSD"):
        d = to_daily(p)
        d23 = d[(d.index >= "2023-01-01") & (d.index <= "2026-06-30")]
        print(f"{p}: total daily bars={len(d)}, 2023..2026-06 bars={len(d23)}, "
              f"range {d.index.min().date()}..{d.index.max().date()}, "
              f"median n5m={int(d['n5m'].median())}")
