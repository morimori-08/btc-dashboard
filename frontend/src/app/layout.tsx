import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BTC Dashboard',
  description: 'BTC Market Real-time Dashboard',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'BTC📊' },
  viewport: { width: 'device-width', initialScale: 1, userScalable: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta name="theme-color" content="#1a1a2e" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js');
          }
        ` }} />
      </head>
      <body style={{ background: '#0f1117', color: '#e0e0e0', fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        {children}
      </body>
    </html>
  )
}
