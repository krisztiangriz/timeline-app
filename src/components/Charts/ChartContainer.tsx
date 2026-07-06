import { useState, useEffect, useRef } from 'react'
import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import { TP } from './chartConstants'
import styles from './Charts.module.css'

export function ChartContainer({ className, children }: { className: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.clientWidth > 0 && el.clientHeight > 0) { setMounted(true); return }
    const ro = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        requestAnimationFrame(() => requestAnimationFrame(() => { setMounted(true); ro.disconnect() }))
      }
    })
    ro.observe(el)
    const timeout = setTimeout(() => { setMounted(true); ro.disconnect() }, 200)
    return () => { ro.disconnect(); clearTimeout(timeout) }
  }, [])
  return <div ref={ref} className={className}>{mounted && children}</div>
}

export function InteractiveLegend({ items, isActive, onToggle }: {
  items: { name: string; color: string }[]
  isActive: (key: string) => boolean
  onToggle: (key: string) => void
}) {
  return (
    <div className={styles.legendContainer}>
      {items.map((item) => (
        <span
          key={item.name}
          className={`${styles.legendItem} ${!isActive(item.name) ? styles.legendItemFaded : ''}`}
          onClick={() => onToggle(item.name)}
        >
          <span className={styles.legendDot} style={{ background: item.color }} />
          {item.name}
        </span>
      ))}
    </div>
  )
}

export function DonutWithLabels({ data, colorFn, containerClass, tooltipProps, isActive, onToggle }: {
  data: { name: string; value: number }[]
  colorFn: (i: number) => string
  containerClass: string
  tooltipProps?: Record<string, unknown>
  isActive?: (key: string) => boolean
  onToggle?: (key: string) => void
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className={containerClass}>
      <div className={styles.pieLayout}>
        <PieChart width={200} height={200} className={styles.pieChartDonut}>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" isAnimationActive={false}>
            {data.map((_: unknown, i: number) => <Cell key={i} fill={colorFn(i)} fillOpacity={isActive && !isActive(data[i].name) ? 0.25 : 1} />)}
          </Pie>
          <Tooltip {...(tooltipProps ?? TP)} />
        </PieChart>
        <div className={styles.pieLabels}>
          {data.map((item, i) => (
            <span
              key={item.name}
              className={`${styles.pieLabelItem} ${onToggle ? styles.pieLabelClickable : ''} ${isActive && !isActive(item.name) ? styles.legendItemFaded : ''}`}
              onClick={onToggle ? () => onToggle(item.name) : undefined}
            >
              <span className={styles.pieLabelDot} style={{ background: colorFn(i) }} />
              {item.name} {total > 0 ? Math.round(item.value / total * 100) : 0}%
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
