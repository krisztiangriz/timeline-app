import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer,
  Cell,
} from 'recharts'
import { usePagesByProperty } from '../../hooks/useChartData'
import { getColor } from '../../constants/colors'
import { EmptyState } from '../EmptyState/EmptyState'
import { TP, axisStroke, tickStyle } from './chartConstants'
import { useContainerClass } from './chartHooks'
import { ChartContainer, DonutWithLabels, InteractiveLegend } from './ChartContainer'
import { useSeriesFilter } from './useSeriesFilter'
import type { ChartRendererProps } from './ChartRenderer'

export function PropertyDistributionChart({ config, pages, hubProperties, propertyValues, containerClass, palette }: ChartRendererProps) {
  const candidateHub = pages.find((p) => p.role === 'candidate-hub')

  const statusProperty = config.propertyId
    ? hubProperties.find((p) => p.id === config.propertyId)
    : hubProperties.find((p) => p.hubId === candidateHub?.id && (!p.scope || p.scope === 'page'))

  const data = usePagesByProperty(pages, statusProperty, propertyValues)
  const cls = useContainerClass(config, containerClass)
  const { chartType } = config
  const { toggle, opacity, isActive } = useSeriesFilter(data.map(d => d.name))

  if (!statusProperty) {
    return (
      <ChartContainer className={cls}>
        <EmptyState compact message="No property selected" />
    </ChartContainer>
    )
  }

  if (chartType === 'pie') {
    return (
      <DonutWithLabels
        data={data}
        colorFn={(i) => data[i]?.color ?? getColor(i, palette)}
        containerClass={cls}
        tooltipProps={TP}
        isActive={data.length > 1 ? isActive : undefined}
        onToggle={data.length > 1 ? toggle : undefined}
      />
    )
  }

  return (
    <>
      <ChartContainer className={cls}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart data={data}>
            <XAxis dataKey="name" tick={tickStyle} stroke={axisStroke} interval={0} />
            <Tooltip {...TP} />
            <Bar dataKey="value" name="Count">
              {data.map((s, i) => <Cell key={s.name || i} fill={s.color} fillOpacity={opacity(s.name)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
      {data.length > 1 && <InteractiveLegend items={data.map(d => ({ name: d.name, color: d.color }))} isActive={isActive} onToggle={toggle} />}
    </>
  )
}
