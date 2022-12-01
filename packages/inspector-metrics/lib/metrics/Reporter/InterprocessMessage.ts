import "source-map-support/register"

import { SerializableMetric } from "../Models/Metric"
import { Tags } from "../Models/Taggable"
import { OverallReportContext } from "./OverallReportContext"
import { ReportingResult } from "./ReportingResult"

export interface InterprocessMessage {
  targetReporterType: string
  type: string
}

export interface InterprocessReportMessage<T> extends InterprocessMessage {
  ctx: OverallReportContext
  date: Date
  tags: Tags
  metrics: {
    counters: Array<ReportingResult<SerializableMetric, T>>
    gauges: Array<ReportingResult<SerializableMetric, T>>
    histograms: Array<ReportingResult<SerializableMetric, T>>
    meters: Array<ReportingResult<SerializableMetric, T>>
    monotoneCounters: Array<ReportingResult<SerializableMetric, T>>
    timers: Array<ReportingResult<SerializableMetric, T>>
  }
}
