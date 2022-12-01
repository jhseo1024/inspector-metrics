import 'source-map-support/register'

import { Metric } from './Models/metric'

export interface MetricSet extends Metric {
  getMetricList(): Metric[]
}
