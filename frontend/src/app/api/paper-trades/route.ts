import { NextResponse } from 'next/server'
import path from 'path'
import os from 'os'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '50')

  const dbPath = path.join(os.homedir(), 'Desktop', 'TradingAgents', 'paper_trade.db')

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3')
    const db = new Database(dbPath, { readonly: true })
    const rows = db.prepare(`
      SELECT s.id, s.ts, s.signal, s.btc_price, s.reasoning,
             t.side, t.size_btc, t.entry_price, t.bitget_order_id, t.status
      FROM signals s
      LEFT JOIN trades t ON t.signal_id = s.id
      ORDER BY s.id DESC
      LIMIT ?
    `).all(limit)
    db.close()
    return NextResponse.json({ trades: rows, total: rows.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ trades: [], total: 0, note: `DB not available: ${message}` })
  }
}
