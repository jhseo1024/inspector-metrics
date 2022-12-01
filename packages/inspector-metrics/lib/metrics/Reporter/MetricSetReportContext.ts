import "source-map-support/register"

import { MetricRegistry } from "../MetricRegistry"
import { MetricType } from "./MetricType"
import { OverallReportContext } from "./OverallReportContext"

export interface MetricSetReportContext<M> {
  overallCtx: OverallReportContext
  metrics: M[]
  readonly registry: MetricRegistry | null
  readonly date: Date
  readonly type: MetricType
}
