import 'source-map-support'

import { InterprocessMessage } from 'inspector-metrics'

export interface InterprocessReportRequest extends InterprocessMessage {
  readonly id: string
}
