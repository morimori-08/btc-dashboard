"""
GitHub Actions から実行されるデータ収集スクリプト。
collector.collect_all() → Supabaseに保存。
"""
import asyncio, json, os, sys
sys.path.insert(0, '.')

from collector import collect_all

async def main():
    print("collecting...")
    data = await collect_all()

    # Supabaseに保存
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")

    if url and key:
        from supabase import create_client
        sb = create_client(url, key)
        ts = data.get("timestamp", "")
        sb.table("snapshots").insert({
            "timestamp": ts,
            "data": json.dumps(data, default=str)
        }).execute()
        print(f"saved: {ts}")

        # 30日以上古いデータを削除
        from datetime import datetime, timedelta, timezone
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        sb.table("snapshots").delete().lt("timestamp", cutoff).execute()
    else:
        print("WARNING: SUPABASE_URL/KEY not set, skipping save")

    print("done")

asyncio.run(main())
