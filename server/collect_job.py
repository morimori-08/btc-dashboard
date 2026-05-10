"""
GitHub Actions から実行されるデータ収集スクリプト。
collect_all() → Supabaseに保存。

保存先:
  snapshots        - 5分精度・30日ローリング（ダッシュボード表示用）
  snapshots_hourly - 1時間精度・削除なし・永久アーカイブ
"""
import asyncio, json, os, sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from collector import collect_all


def _make_archive_payload(data: dict) -> dict:
    """
    hourlyアーカイブ用のスリム版データを作成。
    サイズを削減しつつ全指標を保持:
      - 清算イベントリスト除外 (リアルタイム表示のみ必要、履歴不要)
      - 銘柄別L/S比率は集計のみ保持
      - changes フィールド除外 (生データから再計算可能)
    """
    import copy
    d = copy.deepcopy(data)

    # 清算イベントリストを除外（大きい & 履歴価値なし）
    lh = d.get("liq_heatmap", {})
    lh.pop("okx_recent_liq",  None)
    lh.pop("all_exchange_liq", None)
    d["liq_heatmap"] = lh

    # 銘柄別L/S比率を除外（集計値は残す）
    liq = d.get("liquidations", {})
    liq.pop("bn_taker_ls",  None)
    liq.pop("bn_account_ls", None)
    liq.pop("bn_top_ls",    None)
    d["liquidations"] = liq

    # changes フィールド除外（DBから再計算可能）
    d.pop("changes", None)

    return d


async def main():
    now = datetime.now(timezone.utc)
    print(f"[{now.strftime('%H:%M:%S')}] collecting...")

    try:
        data = await collect_all()
    except Exception as e:
        print(f"ERROR: collect_all failed: {e}")
        raise

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        print("WARNING: SUPABASE_URL/KEY not set, skipping save")
        print(f"  BTC price: ${data.get('btc_price', 'N/A')}")
        return

    from supabase import create_client
    sb = create_client(supabase_url, supabase_key)

    ts = data.get("timestamp", now.isoformat())

    # ── 1. snapshots（5分精度・30日ローリング） ───────────────────────────
    sb.table("snapshots").insert({
        "timestamp": ts,
        "data": json.dumps(data, default=str)
    }).execute()
    print(f"[{now.strftime('%H:%M:%S')}] saved to snapshots: {ts[:19]}")

    btc = data.get('btc_price')
    print(f"  BTC: ${btc:,.0f}" if btc else "  BTC: N/A")
    print(f"  FR coins: {len(data.get('funding_rates', {}))}")

    cutoff = (now - timedelta(days=30)).isoformat()
    sb.table("snapshots").delete().lt("timestamp", cutoff).execute()
    print(f"  cleanup: deleted before {cutoff[:10]}")

    # ── 2. snapshots_hourly（1時間精度・永久保存） ────────────────────────
    # 毎時0〜4分のいずれかの実行で記録 (cron遅延を考慮して5分幅)
    # すでにこの時間帯のレコードがあれば重複書き込みしない
    if now.minute < 5:
        hour_start = now.replace(minute=0, second=0, microsecond=0).isoformat()
        hour_end   = now.replace(minute=5, second=0, microsecond=0).isoformat()

        existing = sb.table("snapshots_hourly") \
            .select("id") \
            .gte("timestamp", hour_start) \
            .lt("timestamp",  hour_end) \
            .limit(1).execute()

        if not existing.data:
            archive_data = _make_archive_payload(data)
            sb.table("snapshots_hourly").insert({
                "timestamp": ts,
                "data": json.dumps(archive_data, default=str)
            }).execute()
            print(f"  archived to snapshots_hourly (hour {now.strftime('%Y-%m-%d %H:00')})")
        else:
            print(f"  hourly already exists for {now.strftime('%H:00')}, skipped")
    else:
        print(f"  hourly archive: skip (minute={now.minute}, records at :00)")


asyncio.run(main())
