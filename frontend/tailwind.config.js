/** @type {import('tailwindcss').Config} */
module.exports = {
  // Preflight is disabled because the existing app/page.tsx monolith was
  // authored without it (see src/app/globals.css top note). We keep utilities
  // + components only; corePlugins.preflight = false makes that explicit.
  corePlugins: {
    preflight: false,
  },
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // premium-terminal tokens mapped to CSS vars (single source of truth)
        bg: {
          DEFAULT: 'var(--bg)',     // bg-bg
          1: 'var(--bg-1)',         // bg-bg-1
          2: 'var(--bg-2)',         // bg-bg-2
        },
        glass: {
          DEFAULT: 'var(--glass)',
          2: 'var(--glass-2)',
        },
        hairline: {
          DEFAULT: 'var(--hairline)',
          2: 'var(--hairline-2)',
        },
        accent: {
          DEFAULT: 'var(--accent)',     // text-accent / bg-accent
          soft: 'var(--accent-soft)',   // bg-accent-soft
        },
        cool: 'var(--cool)',
        up: {
          DEFAULT: 'var(--up)',         // text-up
          soft: 'var(--up-soft)',
        },
        down: {
          DEFAULT: 'var(--down)',       // text-down
          soft: 'var(--down-soft)',
        },
        // text scale (semantic)
        ink: {
          DEFAULT: 'var(--text)',       // text-ink
          dim: 'var(--text-dim)',       // text-ink-dim
          muted: 'var(--text-muted)',   // text-ink-muted
        },
      },
      borderColor: {
        hairline: 'var(--hairline)',
        'hairline-2': 'var(--hairline-2)',
        accent: 'var(--accent)',
      },
      borderRadius: {
        panel: 'var(--r-lg)',   // rounded-panel  (16px)
        core: 'var(--r-md)',    // rounded-core   (12px)
        sm: 'var(--r-sm)',      // rounded-sm     (8px)
        pill: 'var(--r-pill)',  // rounded-pill
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',        // shadow-soft
        panel: 'var(--shadow)',            // shadow-panel
        'inset-hi': 'var(--inset-highlight)',
        'glow-accent': 'var(--glow-accent)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Geist Sans', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.85rem' }],   // 10px micro-labels
      },
      letterSpacing: {
        label: '0.08em',
        wide2: '0.14em',
      },
      transitionTimingFunction: {
        terminal: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      zIndex: {
        tabbar: '30',
        header: '40',
        grain: '60',
      },
    },
  },
  plugins: [],
}
