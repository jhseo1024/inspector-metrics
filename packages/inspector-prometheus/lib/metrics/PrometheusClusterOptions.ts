import 'source-map-support'

import { ClusterOptions } from 'inspector-metrics'

export interface PrometheusClusterOptions<Worker> extends ClusterOptions<Worker> {
  readonly workerResponseTimeout: number
}
