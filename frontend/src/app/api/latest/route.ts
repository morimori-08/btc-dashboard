import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_KEY
  if (!url || !key) return NextResponse.json({ error: 'No Supabase config' }, { status: 500 })

  // Supabase JSクライアントではなくREST APIを直接呼ぶ
  const res = await fetch(
    `${url}/rest/v1/snapshots?select=data&order=id.desc&limit=1`,
    {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      },
      cache: 'no-store',
    }
  )

  if (!res.ok) return NextResponse.json({ error: `Supabase: ${res.status}` }, { status: 500 })

  const rows = await res.json()
  if (!rows.length) return NextResponse.json({ error: 'No data' }, { status: 404 })

  const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  })
}
