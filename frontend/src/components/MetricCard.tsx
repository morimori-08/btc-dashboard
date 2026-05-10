// MetricCard component - also inlined in page.tsx for convenience
export function MetricCard({ label, value, sub, color }: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  const C = {
    card: '#1e2130', border: '#2d3250', text: '#e0e0e0', muted: '#9aa0b4',
  }
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '12px 16px',
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{ fontSize: '0.72rem', color: C.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: color || C.text, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.7rem', color: C.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

export default MetricCard
