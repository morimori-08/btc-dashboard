interface MetricCardProps {
  label: string
  value: string
  sub?: string
  color?: 'default' | 'btc' | 'green' | 'red' | 'cyan'
  size?: 'sm' | 'md' | 'lg'
  glow?: boolean
}

export function MetricCard({ label, value, sub, color = 'default', size = 'md', glow }: MetricCardProps) {
  const colorClass = {
    default: '',
    btc: 'text-btc',
    green: 'text-green',
    red: 'text-red',
    cyan: 'text-cyan',
  }[color]

  const sizeStyle = {
    sm: '1.1rem',
    md: '1.4rem',
    lg: '2.2rem',
  }[size]

  return (
    <div className="glass-card" style={{ padding: '14px 18px', position: 'relative', overflow: 'hidden' }}>
      {/* 角のアクセント */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 40, height: 40,
        background: 'linear-gradient(225deg, rgba(247,147,26,0.08) 0%, transparent 60%)',
        borderRadius: '0 16px 0 0',
      }} />
      <div className="metric-label">{label}</div>
      <div className={`metric-value text-mono ${colorClass}`}
           style={{ fontSize: sizeStyle, color: color === 'default' ? 'var(--text)' : undefined }}>
        {value}
      </div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  )
}

export default MetricCard
