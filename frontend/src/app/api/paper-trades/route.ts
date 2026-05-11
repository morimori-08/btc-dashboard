import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  // This endpoint reads from a local SQLite DB on the developer's machine.
  // On Vercel (remote deployment), the DB is not accessible.
  // Data is visible when running the dashboard locally alongside paper_trader.py.
  return NextResponse.json({ trades: [], total: 0, note: 'Run dashboard locally to see paper trade data' })
}
