import 'source-map-support'

import { MetricReporterOptions, Logger } from 'inspector-metrics'
import { PrometheusClusterOptions } from './PrometheusClusterOptions'

export interface PrometheusReporterOptions extends MetricReporterOptions {
  readonly includeTimestamp?: boolean
  readonly emitComments?: boolean
  readonly useUntyped?: boolean
  clusterOptions?: PrometheusClusterOptions<any>
  log?: Logger
}
