import "source-map-support/register"

import { Metric, SerializableMetric } from "../Models/metric"

export interface ReportingResult<M extends Metric | SerializableMetric, T> {
  readonly metric: M
  readonly result: T
}
