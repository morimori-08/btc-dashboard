interface SignalBannerProps {
  signal: string
  score: number
  price: number
  loading?: boolean
}

export function SignalBanner({ signal, score, price, loading }: SignalBannerProps) {
  const isBull = signal === 'BULL'
  const isBear = signal === 'BEAR'

  type ConfigKey = 'BULL' | 'BEAR' | 'NEUTRAL'
  const configs: Record<ConfigKey, {
    bg: string
    border: string
    glow: string
    color: string
    label: string
    icon: string
  }> = {
    BULL: {
      bg: 'linear-gradient(135deg, rgba(0,255,136,0.06) 0%, rgba(0,255,136,0.02) 100%)',
      border: 'rgba(0,255,136,0.3)',
      glow: 'rgba(0,255,136,0.15)',
      color: '#00FF88',
      label: 'BULL',
      icon: '▲',
    },
    BEAR: {
      bg: 'linear-gradient(135deg, rgba(255,51,102,0.06) 0%, rgba(255,51,102,0.02) 100%)',
      border: 'rgba(255,51,102,0.3)',
      glow: 'rgba(255,51,102,0.15)',
      color: '#FF3366',
      label: 'BEAR',
      icon: '▼',
    },
    NEUTRAL: {
      bg: 'linear-gradient(135deg, rgba(247,147,26,0.04) 0%, rgba(0,212,255,0.02) 100%)',
      border: 'rgba(247,147,26,0.2)',
      glow: 'rgba(247,147,26,0.08)',
      color: '#F7931A',
      label: 'NEUTRAL',
      icon: '◆',
    },
  }

  const config = configs[(signal as ConfigKey)] ?? configs.NEUTRAL

  return (
    <div style={{
      background: config.bg,
      border: `1px solid ${config.border}`,
      borderRadius: 16,
      padding: '14px 24px',
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 12,
      boxShadow: `0 0 32px ${config.glow}`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* スキャンラインエフェクト */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
        opacity: 0.3,
        animation: 'scan-line 4s linear infinite',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `rgba(${isBull ? '0,255,136' : isBear ? '255,51,102' : '247,147,26'},0.12)`,
          border: `1px solid ${config.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.1rem', color: config.color,
          boxShadow: `0 0 16px ${config.glow}`,
        }}>{config.icon}</div>
        <div>
          <div style={{ fontSize: '0.65rem', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>
            市場シグナル
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: config.color, textShadow: `0 0 16px ${config.glow}` }}>
            {config.label}
          </div>
        </div>
        <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.08)' }} />
        <div>
          <div style={{ fontSize: '0.65rem', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>
            スコア
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text)', fontSize: '1rem' }}>
            {score > 0 ? '+' : ''}{score.toFixed(1)}<span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 2 }}>/3.0</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="live-dot" />
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 'clamp(1.2rem, 3vw, 1.6rem)',
          fontWeight: 700,
          color: 'var(--btc)',
          textShadow: '0 0 20px rgba(247,147,26,0.4)',
          letterSpacing: '-0.02em',
        }}>
          {price ? `$${price.toLocaleString(undefined, {maximumFractionDigits: 0})}` : loading ? '---' : 'N/A'}
        </div>
      </div>
    </div>
  )
}

export default SignalBanner
