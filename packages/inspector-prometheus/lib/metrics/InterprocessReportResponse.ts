import 'source-map-support'

import { InterprocessMessage } from 'inspector-metrics'

export interface InterprocessReportResponse extends InterprocessMessage {
  readonly id: string
  readonly metricsStr: string
}
