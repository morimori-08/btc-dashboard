# BTC Dashboard — クラウドデプロイ手順

## アーキテクチャ（全て無料）

```
GitHub Actions (5分毎cron)
    ↓ supabase-py で直接書き込み
Supabase PostgreSQL (無料 500MB)
    ↑ SELECT
FastAPI on Render (無料 512MB)
    ↑ fetch (60秒毎)
Next.js PWA on Vercel (無料)
    ↑ スマホのホーム画面に追加
```

---

## STEP 1: Supabase セットアップ

1. https://supabase.com でアカウント作成（無料）
2. 新しいプロジェクトを作成
3. Settings → API から以下をメモ:
   - **Project URL** (例: `https://xxxx.supabase.co`)
   - **anon public key** (eyJhbGci... で始まる長い文字列)

4. SQL Editor を開き `supabase/schema.sql` の内容を貼り付けて実行:
```sql
CREATE TABLE IF NOT EXISTS snapshots (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data JSONB NOT NULL
);
CREATE INDEX idx_snapshots_timestamp ON snapshots (timestamp DESC);
```

---

## STEP 2: GitHub リポジトリ作成

```bash
cd ~/Desktop/BTC_DASHBOARD
git init
git add .
git commit -m "initial: BTC Dashboard"
# GitHubに新しいpublic repoを作成してpush
git remote add origin https://github.com/[yourname]/btc-dashboard.git
git push -u origin main
```

GitHub Secrets の設定 (Settings → Secrets → Actions):
| Secret名 | 値 |
|---|---|
| `SUPABASE_URL` | Supabaseの Project URL |
| `SUPABASE_KEY` | Supabaseの anon key |
| `COLLECT_SECRET` | 任意の秘密文字列 (例: `my-secret-2026`) |

---

## STEP 3: Render でバックエンドデプロイ

1. https://render.com でアカウント作成（GitHub連携）
2. New → Web Service → リポジトリを選択
3. 設定:
   - **Root Directory**: `server`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free

4. Environment Variables を追加:
   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | Supabaseの URL |
   | `SUPABASE_KEY` | Supabaseの anon key |
   | `COLLECT_SECRET` | 上と同じ秘密文字列 |

5. デプロイ完了後、URLをメモ (例: `https://btc-dashboard-api.onrender.com`)

---

## STEP 4: GitHub Actions の RENDER_API_URL を設定

GitHub Secrets にもう1つ追加:
| Secret名 | 値 |
|---|---|
| `RENDER_API_URL` | `https://btc-dashboard-api.onrender.com` |

`.github/workflows/collect.yml` のenv部分:
```yaml
env:
  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
  COLLECT_SECRET: ${{ secrets.COLLECT_SECRET }}
```

Actions タブで手動実行してテスト:
- `workflow_dispatch` で "Run workflow" をクリック
- ログでエラーがないことを確認

---

## STEP 5: Vercel でフロントエンドデプロイ

1. https://vercel.com でアカウント作成（GitHub連携）
2. New Project → リポジトリを選択
3. 設定:
   - **Root Directory**: `frontend`
   - **Framework**: Next.js (自動検出)

4. Environment Variables を追加:
   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://btc-dashboard-api.onrender.com` |

5. Deploy をクリック
6. 完了後 URL をメモ (例: `https://btc-dashboard.vercel.app`)

---

## STEP 6: PWA をスマホに追加

### iPhone (Safari):
1. `https://btc-dashboard.vercel.app` を Safari で開く
2. 共有ボタン → 「ホーム画面に追加」
3. 名前「BTC📊」で追加
4. ホーム画面からアプリとして起動可能

### Android (Chrome):
1. `https://btc-dashboard.vercel.app` を Chrome で開く
2. メニュー → 「ホーム画面に追加」
3. インストール

---

## 無料枠の制限と対策

| サービス | 制限 | 対策 |
|---|---|---|
| Render | 15分無操作でスリープ、起動30秒 | APIは読み取りのみなのでスリープ許容 |
| Supabase | 500MB, 2週間非アクティブで停止 | 定期アクセス (GitHub Actionsが担う) |
| GitHub Actions | publicリポジトリは無制限 | publicリポジトリ推奨 |
| Vercel | 帯域100GB/月 | 個人利用では問題なし |

## Render スリープ対策

Render無料枠はリクエストがないと15分でスリープします。
GitHub Actionsが5分毎にデータを収集するためAPIを叩くので実質的に起きたまま。

## データ保持期間

`collect_job.py` が30日以上古いデータを自動削除。
Supabase 500MBで約: 500MB ÷ (1スナップショット≈5KB × 288回/日 × 30日) ≈ 無制限に近い

---

## ローカル開発との切り替え

```bash
# ローカル (Streamlit)
cd ~/Desktop/BTC_DASHBOARD
.venv/bin/streamlit run app.py --server.port 8080

# フロントエンド開発
cd ~/Desktop/BTC_DASHBOARD/frontend
npm run dev  # → http://localhost:3000
# .env.local に NEXT_PUBLIC_API_URL=http://localhost:8080 を設定
```
