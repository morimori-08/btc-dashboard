import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_KEY
  if (!url || !key) return NextResponse.json({ error: 'No config' }, { status: 500 })

  const supabase = createClient(url, key)
  const { data, error } = await supabase
    .from('snapshots')
    .select('data, timestamp')
    .order('timestamp', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return NextResponse.json({ error: 'No data' }, { status: 404 })

  const parsed = typeof data.data === 'string' ? JSON.parse(data.data) : data.data
  return NextResponse.json(parsed)
}
