// Vercel API Routes を使用（環境変数不要、同じドメインから呼ぶ）
const BASE = typeof window !== 'undefined' ? '' : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

export async function fetchLatest() {
  try {
    const res = await fetch(`${BASE}/api/latest`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

export async function fetchHistory(hours = 24) {
  try {
    const res = await fetch(`${BASE}/api/history?hours=${hours}`, { cache: 'no-store' })
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

export async function fetchTechnical() {
  // テクニカルデータは latest に含まれる
  const data = await fetchLatest()
  return data?.technical || null
}
