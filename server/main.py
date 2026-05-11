"""
main.py
=======
BTC Dashboard FastAPI backend.
Deploy target: Render free tier (512MB RAM)
Database: Supabase PostgreSQL (or SQLite fallback for local dev)

Endpoints:
  GET  /api/health       - liveness check (DB-free, instant)
  POST /api/collect      - run collector, save to Supabase (GitHub Actions)
  GET  /api/latest       - latest full snapshot
  GET  /api/history      - ?hours=24 history list (max 288 rows)
  GET  /api/coins        - FR/OI per coin per exchange
  GET  /api/technical    - SMA/RSI technical indicators
  GET  /api/liquidations - liquidation data
  GET  /api/changes      - 24h/7d/30d change data
"""

import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

# ---------------------------------------------------------------------------
# Path: allow importing collector.py from parent directory
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
COLLECT_SECRET = os.environ.get("COLLECT_SECRET", "")

# ---------------------------------------------------------------------------
# Supabase client (optional)
# ---------------------------------------------------------------------------
supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        from supabase import create_client, Client
        supabase: Optional[Client] = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase client initialized: %s", SUPABASE_URL[:40])
    except Exception as e:
        logger.warning("Supabase init failed, falling back to SQLite: %s", e)
        supabase = None
else:
    logger.info("SUPABASE_URL/KEY not set — using SQLite fallback")

# ---------------------------------------------------------------------------
# SQLite fallback (local dev / no Supabase)
# ---------------------------------------------------------------------------
SQLITE_PATH = os.environ.get("SQLITE_PATH", "data/dashboard.db")


def _sqlite_save(data: dict) -> None:
    try:
        from db import save_snapshot
        save_snapshot(data, db_path=SQLITE_PATH)
    except Exception as e:
        logger.error("SQLite save failed: %s", e)


def _sqlite_latest() -> Optional[dict]:
    try:
        from db import get_latest, init_db
        init_db(SQLITE_PATH)
        return get_latest(db_path=SQLITE_PATH)
    except Exception as e:
        logger.error("SQLite get_latest failed: %s", e)
        return None


def _sqlite_history(hours: int = 24) -> list:
    try:
        from db import get_history, init_db
        init_db(SQLITE_PATH)
        return get_history(hours=hours, db_path=SQLITE_PATH)
    except Exception as e:
        logger.error("SQLite get_history failed: %s", e)
        return []


# ---------------------------------------------------------------------------
# Storage helpers (Supabase preferred, SQLite fallback)
# ---------------------------------------------------------------------------

def _save_to_db(data: dict) -> None:
    """Persist snapshot to Supabase or SQLite."""
    if supabase:
        try:
            ts = data.get("timestamp", datetime.now(timezone.utc).isoformat())
            json_str = json.dumps(data, ensure_ascii=False)
            supabase.table("snapshots").insert(
                {"timestamp": ts, "data": json_str}
            ).execute()
            logger.info("Saved snapshot to Supabase ts=%s", ts)
        except Exception as e:
            logger.error("Supabase insert failed: %s", e)
            _sqlite_save(data)
    else:
        _sqlite_save(data)


def _get_latest_from_db() -> Optional[dict]:
    """Fetch latest snapshot from Supabase or SQLite."""
    if supabase:
        try:
            result = (
                supabase.table("snapshots")
                .select("*")
                .order("timestamp", desc=True)
                .limit(1)
                .execute()
            )
            rows = result.data or []
            if rows:
                return json.loads(rows[0]["data"])
        except Exception as e:
            logger.error("Supabase latest failed: %s", e)
    return _sqlite_latest()


def _get_history_from_db(hours: int = 24, limit: int = 288) -> list:
    """Fetch history snapshots from Supabase or SQLite."""
    if supabase:
        try:
            from datetime import timedelta
            cutoff = (
                datetime.now(timezone.utc) - timedelta(hours=hours)
            ).isoformat()
            result = (
                supabase.table("snapshots")
                .select("timestamp,data")
                .gte("timestamp", cutoff)
                .order("timestamp", desc=True)
                .limit(limit)
                .execute()
            )
            rows = result.data or []
            # Return oldest-first (same as SQLite convention)
            rows = list(reversed(rows))
            return [{"timestamp": r["timestamp"], **json.loads(r["data"])} for r in rows]
        except Exception as e:
            logger.error("Supabase history failed: %s", e)
    return _sqlite_history(hours=hours)


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="BTC Dashboard API",
    description="Real-time BTC market data aggregator",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: narrow to Vercel URL after deploy
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Auth dependency for /api/collect
# ---------------------------------------------------------------------------

def _verify_collect_secret(x_collect_secret: str = Header(default="")) -> None:
    """Validate X-Collect-Secret header when COLLECT_SECRET env var is set."""
    if COLLECT_SECRET and x_collect_secret != COLLECT_SECRET:
        raise HTTPException(status_code=403, detail="Invalid or missing X-Collect-Secret")


# ---------------------------------------------------------------------------
# Background task: collect + save
# ---------------------------------------------------------------------------

async def run_collect_and_save() -> None:
    """Run collector.collect_all() and persist the result."""
    try:
        import collector
        import asyncio
        logger.info("Starting data collection...")
        data = await collector.collect_all()
        _save_to_db(data)
        logger.info("Collection + save complete. ts=%s", data.get("timestamp"))
    except Exception as e:
        logger.error("run_collect_and_save failed: %s", e, exc_info=True)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    """Liveness probe — no DB access, instant response."""
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "storage": "supabase" if supabase else "sqlite",
    }


@app.post("/api/collect")
async def collect(
    background_tasks: BackgroundTasks,
    _: None = Depends(_verify_collect_secret),
):
    """
    Trigger a data collection cycle.
    Returns immediately; actual collection runs in background.
    Called by GitHub Actions every 5 minutes.
    """
    background_tasks.add_task(run_collect_and_save)
    return {
        "status": "collecting",
        "queued_at": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/latest")
async def latest():
    """Return the most recent full snapshot."""
    data = _get_latest_from_db()
    if data is None:
        raise HTTPException(status_code=404, detail="No snapshots found")
    return data


@app.get("/api/history")
async def history(hours: int = 24):
    """
    Return snapshots from the last N hours (max 288 rows = 24h at 5min intervals).
    ?hours=24  (default 24, max 720)
    """
    hours = max(1, min(hours, 720))
    limit = min(288, hours * 12)  # 12 snapshots per hour at 5-min intervals
    rows = _get_history_from_db(hours=hours, limit=limit)
    return {
        "hours": hours,
        "count": len(rows),
        "snapshots": rows,
    }


@app.get("/api/coins")
async def coins():
    """Return FR/OI data for all 15 coins across all exchanges."""
    data = _get_latest_from_db()
    if data is None:
        raise HTTPException(status_code=404, detail="No data available")
    return {
        "timestamp": data.get("timestamp"),
        "funding_rates": data.get("funding_rates", {}),
        "fr_aggregate": data.get("fr_aggregate", {}),
        "open_interest": data.get("open_interest", {}),
        "oi_total": data.get("oi_total", {}),
    }


@app.get("/api/technical")
async def technical():
    """Return SMA/RSI technical indicators (1H/4H/1D/1W timeframes)."""
    data = _get_latest_from_db()
    if data is None:
        raise HTTPException(status_code=404, detail="No data available")
    return {
        "timestamp": data.get("timestamp"),
        "btc_price": data.get("btc_price"),
        **data.get("technical", {}),
    }


@app.get("/api/liquidations")
async def liquidations():
    """Return liquidation data (OKX, BitMEX, Binance L/S, heatmap)."""
    data = _get_latest_from_db()
    if data is None:
        raise HTTPException(status_code=404, detail="No data available")
    return {
        "timestamp": data.get("timestamp"),
        "liquidations": data.get("liquidations", {}),
        "liq_heatmap": data.get("liq_heatmap", {}),
    }


@app.get("/api/changes")
async def changes():
    """Return 24h/7d/30d change data for key metrics."""
    data = _get_latest_from_db()
    if data is None:
        raise HTTPException(status_code=404, detail="No data available")
    return {
        "timestamp": data.get("timestamp"),
        "btc_price": data.get("btc_price"),
        "changes": data.get("changes", {}),
    }


@app.get("/api/paper-trades")
async def paper_trades(limit: int = 50):
    """AIペーパートレード履歴を返す（シグナル + トレード結合）"""
    import sqlite3 as _sqlite3
    db_path = os.path.expanduser("~/Desktop/TradingAgents/paper_trade.db")
    if not os.path.exists(db_path):
        return {"trades": [], "total": 0}
    try:
        conn = _sqlite3.connect(db_path)
        conn.row_factory = _sqlite3.Row
        rows = conn.execute("""
            SELECT
                s.id, s.ts, s.signal, s.btc_price, s.reasoning,
                t.side, t.size_btc, t.entry_price, t.bitget_order_id, t.status
            FROM signals s
            LEFT JOIN trades t ON t.signal_id = s.id
            ORDER BY s.id DESC
            LIMIT ?
        """, (limit,)).fetchall()
        conn.close()
        return {
            "trades": [dict(r) for r in rows],
            "total": len(rows),
        }
    except Exception as e:
        return {"error": str(e), "trades": []}
