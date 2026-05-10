'use client'
// CandleChart - lightweight-charts based candlestick chart
// Usage: <CandleChart data={ohlcv} />
import { useEffect, useRef } from 'react'

interface OHLCV {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export function CandleChart({ data }: { data: OHLCV[] }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || !data?.length) return

    let chart: any = null

    import('lightweight-charts').then(({ createChart }) => {
      chart = createChart(containerRef.current!, {
        width: containerRef.current!.clientWidth,
        height: 280,
        layout: { background: { color: '#1e2130' }, textColor: '#9aa0b4' },
        grid: { vertLines: { color: '#2d3250' }, horzLines: { color: '#2d3250' } },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: '#2d3250' },
        timeScale: { borderColor: '#2d3250', timeVisible: true },
      })

      const candleSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      })

      candleSeries.setData(data)
      chart.timeScale().fitContent()
    })

    return () => {
      chart?.remove()
    }
  }, [data])

  return <div ref={containerRef} style={{ width: '100%', height: 280 }} />
}

export default CandleChart
