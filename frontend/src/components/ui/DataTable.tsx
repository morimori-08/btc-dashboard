import { type ReactNode } from 'react'
import { cn } from './cn'
import { HeatCell } from './HeatCell'
import { TableSkeleton } from './Skeleton'
import { EmptyState } from './EmptyState'

export interface Column<Row> {
  key: string
  header: ReactNode
  /** Cell content. Receives the row and index. */
  cell: (row: Row, index: number) => ReactNode
  align?: 'left' | 'right' | 'center'
  /** Render this column as a sign/magnitude HeatCell. Return the numeric value. */
  heat?: (row: Row) => number | null | undefined
  /** Override the HeatCell magnitude scale for this column. */
  heatScale?: number
  /** Monospace + tabular numerals for the cell (default true for non-first cols). */
  mono?: boolean
  className?: string
  /** Fixed/min width in px. */
  width?: number
}

export interface DataTableProps<Row> {
  columns: Column<Row>[]
  rows: Row[]
  rowKey: (row: Row, index: number) => string | number
  dense?: boolean
  loading?: boolean
  /** Custom empty node; defaults to a composed EmptyState. */
  empty?: ReactNode
  /** Min table width to force horizontal scroll on small screens. */
  minWidth?: number
  caption?: string
  className?: string
}

/**
 * DataTable — hairline-divided, tabular table with optional per-column HeatCell.
 * Handles loading (skeleton) and empty (composed) states. Row hover is CSS.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  dense = false,
  loading = false,
  empty,
  minWidth,
  caption,
  className,
}: DataTableProps<Row>) {
  const padCell = dense ? 'px-2.5 py-1.5' : 'px-3 py-[9px]'
  const padHead = dense ? 'px-2.5 py-2' : 'px-3 py-2.5'

  if (loading) {
    return <TableSkeleton rows={dense ? 6 : 5} cols={columns.length} />
  }

  if (!rows.length) {
    return <>{empty ?? <EmptyState />}</>
  }

  const alignClass = (a?: 'left' | 'right' | 'center') =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left'

  return (
    <div className={cn('w-full overflow-x-auto', className)} style={{ WebkitOverflowScrolling: 'touch' }}>
      <table className="w-full border-collapse" style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-hairline-2">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  padHead,
                  'text-2xs font-medium uppercase tracking-label text-ink-muted',
                  alignClass(col.align),
                )}
                style={{ width: col.width, minWidth: col.width }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              className="border-b border-hairline transition-colors duration-150 last:border-b-0 hover:bg-[var(--accent-soft)]"
            >
              {columns.map((col) => {
                if (col.heat) {
                  return (
                    <HeatCell
                      key={col.key}
                      value={col.heat(row)}
                      scale={col.heatScale}
                      align={col.align ?? 'right'}
                      className={cn(dense ? 'px-2.5 py-1.5' : 'px-3 py-[9px]', col.className)}
                    >
                      {col.cell(row, i)}
                    </HeatCell>
                  )
                }
                const isMono = col.mono ?? col.align === 'right'
                return (
                  <td
                    key={col.key}
                    className={cn(
                      padCell,
                      alignClass(col.align),
                      isMono ? 'tabular font-mono text-[0.78rem] text-ink' : 'text-[0.8rem] font-medium text-ink',
                      col.className,
                    )}
                    style={{ width: col.width, minWidth: col.width }}
                  >
                    {col.cell(row, i)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
