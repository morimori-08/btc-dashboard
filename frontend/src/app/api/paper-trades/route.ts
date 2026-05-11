import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_KEY || ''

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '50')

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ trades: [], total: 0, note: 'Supabase not configured' })
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/paper_trades?select=*&order=id.desc&limit=${limit}`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        cache: 'no-store',
      }
    )

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ trades: [], total: 0, note: `Supabase error: ${err.slice(0, 100)}` })
    }

    const rows = await res.json()
    return NextResponse.json({ trades: rows, total: rows.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ trades: [], total: 0, note: `Fetch error: ${message}` })
  }
}
