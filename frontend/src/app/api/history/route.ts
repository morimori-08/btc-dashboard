import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_KEY
  if (!url || !key) return NextResponse.json([], { status: 500 })

  const { searchParams } = new URL(req.url)
  const hours = Math.min(parseInt(searchParams.get('hours') || '24'), 168)
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString()

  const supabase = createClient(url, key)
  const { data, error } = await supabase
    .from('snapshots')
    .select('data, timestamp')
    .gte('timestamp', since)
    .order('timestamp', { ascending: false })
    .limit(hours * 12)

  if (error) return NextResponse.json([])

  return NextResponse.json((data || []).map(row => ({
    timestamp: row.timestamp,
    ...(typeof row.data === 'string' ? JSON.parse(row.data) : row.data)
  })))
}
