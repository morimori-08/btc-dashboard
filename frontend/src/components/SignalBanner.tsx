// SignalBanner component - also inlined in page.tsx for convenience
export function SignalBanner({ signal, score, price }: {
  signal: string
  score: number
  price: number
}) {
  const C = { bull: '#4dff88', bear: '#ff6666' }
  const isBull = signal === 'BULL'
  const isBear = signal === 'BEAR'
  const bg = isBull
    ? 'linear-gradient(135deg,#0d3318,#1a5c2e)'
    : isBear
    ? 'linear-gradient(135deg,#330d0d,#5c1a1a)'
    : 'linear-gradient(135deg,#1e1e2e,#2a2a3e)'
  const color = isBull ? C.bull : isBear ? C.bear : '#aac'
  const icon = isBull ? '📈' : isBear ? '📉' : '➡️'
  return (
    <div style={{
      background: bg,
      borderRadius: 10,
      padding: '12px 16px',
      textAlign: 'center',
      color,
      fontWeight: 700,
      fontSize: '1.05rem',
      marginBottom: 12,
    }}>
      {icon} 総合シグナル: <b>{signal}</b> &nbsp;|&nbsp; スコア {score > 0 ? '+' : ''}{score.toFixed(1)}/3.0
      &nbsp;|&nbsp; BTC <b>${price?.toLocaleString()}</b>
    </div>
  )
}

export default SignalBanner
