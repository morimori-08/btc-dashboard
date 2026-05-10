"""
db.py
=====
SQLite snapshot storage for BTC dashboard data.

Tables:
  snapshots: id, timestamp, data_json
"""
import json
import sqlite3
import os
from typing import Optional


def _connect(db_path: str) -> sqlite3.Connection:
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    return sqlite3.connect(db_path)


def init_db(db_path: str = "data/dashboard.db") -> None:
    """Create tables if they don't exist."""
    with _connect(db_path) as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS snapshots (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                data_json TEXT NOT NULL
            )
        """)
        con.execute("CREATE INDEX IF NOT EXISTS idx_ts ON snapshots(timestamp)")
        con.commit()


def save_snapshot(data: dict, db_path: str = "data/dashboard.db") -> None:
    """Insert a full data snapshot into the DB."""
    init_db(db_path)
    ts = data.get("timestamp", "")
    with _connect(db_path) as con:
        con.execute(
            "INSERT INTO snapshots (timestamp, data_json) VALUES (?, ?)",
            (ts, json.dumps(data, ensure_ascii=False))
        )
        con.commit()


def get_latest(db_path: str = "data/dashboard.db") -> Optional[dict]:
    """Return the most recent snapshot, or None if the table is empty."""
    init_db(db_path)
    with _connect(db_path) as con:
        row = con.execute(
            "SELECT data_json FROM snapshots ORDER BY id DESC LIMIT 1"
        ).fetchone()
    if row:
        return json.loads(row[0])
    return None


def get_history(hours: int = 24, db_path: str = "data/dashboard.db") -> list[dict]:
    """Return snapshots from the last N hours, oldest first."""
    init_db(db_path)
    with _connect(db_path) as con:
        rows = con.execute(
            """
            SELECT data_json FROM snapshots
            WHERE timestamp >= datetime('now', ? || ' hours')
            ORDER BY id ASC
            """,
            (f"-{hours}",)
        ).fetchall()
    return [json.loads(r[0]) for r in rows]
