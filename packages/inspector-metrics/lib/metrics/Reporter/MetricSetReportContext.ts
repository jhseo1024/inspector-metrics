import "source-map-support/register"

import { MetricRegistry } from "../metric-registry"
import { MetricType } from "./metric-type"
import { OverallReportContext } from "./overall-report-context"

export interface MetricSetReportContext<M> {
  overallCtx: OverallReportContext
  metrics: M[]
  readonly registry: MetricRegistry | null
  readonly date: Date
  readonly type: MetricType
}
