'use client'
// FlowChart - ETF/Exchange flow bar chart using recharts
// Usage: <FlowChart data={history} />
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

export function FlowChart({ data }: { data: Array<{ date: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9aa0b4' }} />
        <YAxis tick={{ fontSize: 10, fill: '#9aa0b4' }} />
        <Tooltip
          contentStyle={{ background: '#1e2130', border: '1px solid #2d3250', borderRadius: 6 }}
          labelStyle={{ color: '#9aa0b4' }}
        />
        <ReferenceLine y={0} stroke="#2d3250" />
        <Bar dataKey="value" fill="#26a69a"
          label={false}
          // Red for negative values
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default FlowChart
