import 'source-map-support/register'

import { Metric } from './Models/metric'

export interface MetricRegistryListener {
  metricAdded(name: string, metric: Metric): void
  metricRemoved(name: string, metric: Metric): void
}
