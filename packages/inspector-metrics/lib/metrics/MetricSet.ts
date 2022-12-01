import 'source-map-support/register'

import { Metric } from './Models/Metric'

export interface MetricSet extends Metric {
  getMetricList(): Metric[]
}
