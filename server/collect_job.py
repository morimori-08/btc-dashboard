"""
GitHub Actions から実行されるデータ収集スクリプト。
collect_all() → Supabaseに保存。
"""
import asyncio, json, os, sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# プロジェクトルートをパスに追加
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from collector import collect_all

async def main():
    print(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] collecting...")
    
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

    # INSERT
    ts = data.get("timestamp", datetime.now(timezone.utc).isoformat())
    result = sb.table("snapshots").insert({
        "timestamp": ts,
        "data": json.dumps(data, default=str)
    }).execute()
    
    print(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] saved: {ts}")
    print(f"  BTC: ${data.get('btc_price', 'N/A'):,.0f}" if data.get('btc_price') else "  BTC: N/A")
    print(f"  FR coins: {len(data.get('funding_rates', {}))}")

    # 30日以上古いデータを削除
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    sb.table("snapshots").delete().lt("timestamp", cutoff).execute()
    print(f"  cleanup: deleted records before {cutoff[:10]}")

asyncio.run(main())
