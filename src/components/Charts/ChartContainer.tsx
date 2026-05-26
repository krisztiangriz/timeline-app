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

export function cellLegend(items: { name: string; color: string }[]) {
  return () => (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', paddingTop: 4 }}>
      {items.map((item) => (
        <span key={item.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--color-text-body)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
          {item.name}
        </span>
      ))}
    </div>
  )
}

export function DonutWithLabels({ data, colorFn, containerClass, tooltipProps }: {
  data: { name: string; value: number }[]
  colorFn: (i: number) => string
  containerClass: string
  tooltipProps?: Record<string, unknown>
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className={containerClass}>
      <div className={styles.pieLayout}>
        <PieChart width={200} height={200} className={styles.pieChartDonut}>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" isAnimationActive={false}>
            {data.map((_: unknown, i: number) => <Cell key={i} fill={colorFn(i)} />)}
          </Pie>
          <Tooltip {...(tooltipProps ?? TP)} />
        </PieChart>
        <div className={styles.pieLabels}>
          {data.map((item, i) => (
            <span key={item.name} className={styles.pieLabelItem}>
              <span className={styles.pieLabelDot} style={{ background: colorFn(i) }} />
              {item.name} {total > 0 ? Math.round(item.value / total * 100) : 0}%
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
