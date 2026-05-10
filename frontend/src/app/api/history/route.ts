import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_KEY
  if (!url || !key) return NextResponse.json([], { status: 500 })

  const { searchParams } = new URL(req.url)
  const hours = Math.min(parseInt(searchParams.get('hours') || '24'), 168)
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString()
  const limit = hours * 12

  const res = await fetch(
    `${url}/rest/v1/snapshots?select=data,timestamp&order=id.desc&limit=${limit}&timestamp=gte.${since}`,
    {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` },
      cache: 'no-store',
    }
  )

  if (!res.ok) return NextResponse.json([])

  const rows = await res.json()
  const result = rows.map((row: any) => ({
    timestamp: row.timestamp,
    ...(typeof row.data === 'string' ? JSON.parse(row.data) : row.data)
  }))

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  })
}
