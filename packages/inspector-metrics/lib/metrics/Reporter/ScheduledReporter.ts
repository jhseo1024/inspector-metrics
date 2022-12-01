import "source-map-support/register"

import { MILLISECOND, TimeUnit } from "../Models/TimeUnit"
import { MetricReporter } from "./MetricReporter"
import { MetricReporterOptions } from "./MetricReporterOptions"

export type Scheduler = (prog: () => Promise<any>, interval: number) => NodeJS.Timer

export interface ScheduledMetricReporterOptions extends MetricReporterOptions {
  readonly reportInterval?: number
  readonly unit?: TimeUnit
  readonly scheduler?: Scheduler
}

export abstract class ScheduledMetricReporter<O extends ScheduledMetricReporterOptions, T> extends MetricReporter<O, T> {
  private timer: NodeJS.Timer

  public constructor(options: O, reporterType?: string) {
    super(options, reporterType)
  }

  public async start(): Promise<this> {
    const interval: number = this.options.unit.convertTo(this.options.reportInterval, MILLISECOND)
    this.timer = this.options.scheduler(async () => this.report(), interval)
    return this
  }

  public async stop(): Promise<this> {
    if (this.timer) {
      this.timer.unref()
    }
    return this
  }
}
