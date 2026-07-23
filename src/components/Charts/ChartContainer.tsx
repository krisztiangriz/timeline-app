import { useState, useEffect, useRef } from 'react'
import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import { TP } from './chartConstants'
import { ColorPicker } from '../ColorPicker/ColorPicker'
import { PALETTE_OPTIONS } from '../../constants/colors'
import { useColorPicker } from './useColorPicker'
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

export function InteractiveLegend({ items, isActive, onToggle, onColorChange }: {
  items: { name: string; color: string }[]
  isActive: (key: string) => boolean
  onToggle: (key: string) => void
  onColorChange?: (key: string, color: string) => void
}) {
  const { pickerKey, dotRef, handleClose, openPicker, selectAndClose } = useColorPicker()

  return (
    <div className={styles.legendContainer}>
      {items.map((item) => (
        <span
          key={item.name}
          className={`${styles.legendItem} ${!isActive(item.name) ? styles.legendItemFaded : ''}`}
          onClick={() => onToggle(item.name)}
        >
          <span
            className={styles.legendDot}
            style={{ background: item.color }}
            onClick={(e) => { if (onColorChange) { e.stopPropagation(); openPicker(item.name, e.currentTarget) } }}
            role={onColorChange ? 'button' : undefined}
            aria-label={onColorChange ? `Change color for ${item.name}` : undefined}
            tabIndex={onColorChange ? 0 : undefined}
            onKeyDown={onColorChange ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openPicker(item.name, e.currentTarget) } } : undefined}
          />
          {item.name}
        </span>
      ))}
      {pickerKey && onColorChange && (
        <ColorPicker
          colors={PALETTE_OPTIONS}
          value={items.find(i => i.name === pickerKey)?.color}
          onChange={(color) => selectAndClose(onColorChange, color)}
          onClose={handleClose}
          anchorRef={dotRef as React.RefObject<HTMLElement>}
          position="above"
        />
      )}
    </div>
  )
}

export function DonutWithLabels({ data, colorFn, containerClass, tooltipProps, isActive, onToggle, onColorChange, items }: {
  data: { name: string; value: number }[]
  colorFn: (i: number) => string
  containerClass: string
  tooltipProps?: Record<string, unknown>
  isActive?: (key: string) => boolean
  onToggle?: (key: string) => void
  onColorChange?: (key: string, color: string) => void
  items?: { name: string; value: number; color?: string }[]
}) {
  const { pickerKey, dotRef, handleClose, openPicker, selectAndClose } = useColorPicker()

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
              <span
                className={styles.pieLabelDot}
                style={{ background: colorFn(i) }}
                onClick={onColorChange ? (e) => { e.stopPropagation(); openPicker(item.name, e.currentTarget) } : undefined}
                role={onColorChange ? 'button' : undefined}
                aria-label={onColorChange ? `Change color for ${item.name}` : undefined}
                tabIndex={onColorChange ? 0 : undefined}
                onKeyDown={onColorChange ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openPicker(item.name, e.currentTarget) } } : undefined}
              />
              {item.name} {total > 0 ? Math.round(item.value / total * 100) : 0}%
            </span>
          ))}
        </div>
      </div>
      {pickerKey && onColorChange && (
        <ColorPicker
          colors={PALETTE_OPTIONS}
          value={items?.find(i => i.name === pickerKey)?.color ?? colorFn(data.findIndex(d => d.name === pickerKey))}
          onChange={(color) => selectAndClose(onColorChange, color)}
          onClose={handleClose}
          anchorRef={dotRef as React.RefObject<HTMLElement>}
          position="above"
        />
      )}
    </div>
  )
}
