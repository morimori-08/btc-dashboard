import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { JetBrains_Mono } from 'next/font/google'
import './globals.css'

// Numeric / tabular font. Exposed as --font-mono, consumed by globals.css (--mono).
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
})

// Geist Sans (geist package) is the UI font. It exposes --font-geist-sans;
// we alias it to --font-sans below so globals.css tokens stay framework-neutral.

export const metadata: Metadata = {
  title: 'BTC NEXUS — Market Intelligence',
  description: 'Real-time Bitcoin market data: FR, OI, DVOL, ETF Flow, Exchange Flow',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: '₿NEXUS' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  userScalable: true,   // ユーザーがピンチズームできるように
  themeColor: '#060709',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ja"
      className={`${GeistSans.variable} ${jetbrainsMono.variable}`}
      style={{ ['--font-sans' as string]: 'var(--font-geist-sans)' }}
    >
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
        ` }} />
      </head>
      <body className="font-sans">
        <div className="grain-overlay" aria-hidden="true" />
        {children}
      </body>
    </html>
  )
}
