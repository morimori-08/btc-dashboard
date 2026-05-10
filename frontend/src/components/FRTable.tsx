// FRTable - Funding Rate heatmap table component
// Usage: <FRTable fr={fr_aggregate} />
export function FRTable({ fr }: { fr: Record<string, any> }) {
  const C = {
    card: '#1e2130', border: '#2d3250', muted: '#9aa0b4',
    red: '#ef5350', blue: '#4488ff',
  }

  const fmtPct = (v: number | null | undefined, decimals = 4) =>
    v == null ? 'N/A' : `${(v * 100) > 0 ? '+' : ''}${(v * 100).toFixed(decimals)}%`

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ background: C.card }}>
            {['銘柄', '平均FR', '最大', '最小', '乖離幅', '取引所数'].map(h => (
              <th key={h} style={{ padding: '6px 8px', textAlign: 'right', color: C.muted, fontWeight: 500 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(fr).map(([coin, agg]: [string, any]) => {
            const avg = agg.avg || 0
            const rowColor = avg > 0.0003 ? '#4d1a1a' : avg < -0.0003 ? '#1a1a4d' : C.card
            return (
              <tr key={coin} style={{ background: rowColor, borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '5px 8px', fontWeight: 600 }}>{coin}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', color: avg > 0 ? C.red : C.blue }}>
                  {fmtPct(avg)}
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'right', color: C.red }}>{fmtPct(agg.max)}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', color: C.blue }}>{fmtPct(agg.min)}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right' }}>{fmtPct(agg.spread)}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', color: C.muted }}>{agg.n_exchanges}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default FRTable
