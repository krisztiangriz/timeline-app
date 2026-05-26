import type { ChartConfig, TimelineEntry, Page, HubProperty, PagePropertyValue, Feedback } from '../../types'
import { EntryCountChart, EntryByWeekdayChart, PageCountChart } from './EntryCharts'
import { FeedbackByTypeChart, FeedbackByDimensionChart, FeedbackOverTimeChart, FeedbackPerPageChart } from './FeedbackCharts'
import { PropertyDistributionChart } from './PropertyChart'

// Re-export for consumers (AddChartModal, ConfigurableViz)
export { DATA_SOURCE_LABELS, VALID_CHART_TYPES } from './chartConstants'

export interface ChartRendererProps {
  config: ChartConfig
  monthCount?: 0 | 3 | 6 | 12
  entries: TimelineEntry[]
  pages: Page[]
  hubProperties: HubProperty[]
  feedbacks: Feedback[]
  propertyValues: PagePropertyValue[]
  containerClass?: string
  palette: string[]
}

export function ChartRenderer(props: ChartRendererProps) {
  switch (props.config.dataSource) {
    case 'entry-count': return <EntryCountChart {...props} />
    case 'entry-by-weekday': return <EntryByWeekdayChart {...props} />
    case 'property-distribution': return <PropertyDistributionChart {...props} />
    case 'page-count': return <PageCountChart {...props} />
    case 'feedback-by-type': return <FeedbackByTypeChart {...props} />
    case 'feedback-by-dimension': return <FeedbackByDimensionChart {...props} />
    case 'feedback-over-time': return <FeedbackOverTimeChart {...props} />
    case 'feedback-per-page': return <FeedbackPerPageChart {...props} />
    default: return null
  }
}
