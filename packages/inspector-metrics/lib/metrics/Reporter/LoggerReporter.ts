import "source-map-support/register"

import { StdClock } from "../clock"
import { Counter, MonotoneCounter } from "../counter"
import { Event } from "../event"
import { Gauge } from "../gauge"
import { Histogram } from "../histogram"
import { Meter } from "../meter"
import { MetricRegistry } from "../metric-registry"
import { MILLISECOND } from "../Models/time-unit"
import { Timer } from "../timer"
import { Logger } from "./logger"
import { DefaultClusterOptions } from "./metric-reporter-options"
import { MetricSetReportContext } from "./metric-set-report-context"
import { MetricType } from "./metric-type"
import { OverallReportContext } from "./overall-report-context"
import { ReportingResult } from "./reporting-result"
import { ScheduledMetricReporter, ScheduledMetricReporterOptions } from "./scheduled-reporter"

interface LogLine {
  message: string
  metadata: any
}

interface LoggerReportingContext<M> extends MetricSetReportContext<M> {
  readonly logMetadata: any
}

export interface LoggerReporterOptions extends ScheduledMetricReporterOptions {
  log?: Logger
}

export class LoggerReporter extends ScheduledMetricReporter<LoggerReporterOptions, LogLine> {
  private logMetadata: any

  public constructor({
    log = console,
    reportInterval = 1000,
    unit = MILLISECOND,
    clock = new StdClock(),
    scheduler = setInterval,
    minReportingTimeout = 1,
    tags = new Map(),
    clusterOptions = new DefaultClusterOptions(),
  }: LoggerReporterOptions,
    reporterType?: string) {
    super({
      clock,
      clusterOptions,
      log,
      minReportingTimeout,
      reportInterval,
      scheduler,
      tags,
      unit,
    }, reporterType)
    this.logMetadata = {
      reportInterval,
      tags,
      unit,
    }
  }

  public getLog(): Logger {
    return this.options.log
  }

  public setLog(log: Logger): this {
    this.options.log = log
    return this
  }

  public async reportEvent<TEventData, TEvent extends Event<TEventData>>(event: TEvent): Promise<TEvent> {
    const ctx: LoggerReportingContext<TEvent> = this
      .createMetricSetReportContext({}, null, event.getTime(), "gauge")
    const logLine: LogLine = this.reportGauge(event, ctx)
    if (logLine) {
      this.options.log.info(logLine.message, logLine.metadata)
    }
    return event
  }

  protected createMetricSetReportContext(
    overallCtx: OverallReportContext,
    registry: MetricRegistry,
    date: Date,
    type: MetricType): LoggerReportingContext<any> {
    const logMetadata = Object.assign({}, this.logMetadata, {
      measurement: "",
      measurement_type: type,
      timestamp: date,
    })
    return {
      date,
      logMetadata,
      metrics: [],
      overallCtx,
      registry,
      type,
    }
  }

  protected async handleResults(
    ctx: OverallReportContext,
    registry: MetricRegistry | null,
    date: Date,
    type: MetricType,
    results: Array<ReportingResult<any, LogLine>>) {
    for (const logLine of results) {
      this.options.log.info(logLine.result.message, logLine.result.metadata)
    }
  }

  protected reportCounter(
    counter: MonotoneCounter | Counter, ctx: LoggerReportingContext<MonotoneCounter | Counter>): LogLine {
    if (!isNaN(counter.getCount())) {
      const name = counter.getName()
      ctx.logMetadata.measurement = name
      ctx.logMetadata.group = counter.getGroup()
      ctx.logMetadata.tags = this.buildTags(ctx.registry, counter)
      return {
        message: `${ctx.date} - counter ${name}: ${counter.getCount()}`,
        metadata: Object.assign({}, ctx.logMetadata),
      }
    }
    return null
  }

  protected reportGauge(gauge: Gauge<any>, ctx: LoggerReportingContext<Gauge<any>>): LogLine {
    if (!Number.isNaN(gauge.getValue())) {
      const name = gauge.getName()
      ctx.logMetadata.measurement = name
      ctx.logMetadata.group = gauge.getGroup()
      ctx.logMetadata.tags = this.buildTags(ctx.registry, gauge)
      return {
        message: `${ctx.date} - gauge ${name}: ${gauge.getValue()}`,
        metadata: Object.assign({}, ctx.logMetadata),
      }
    }
    return null
  }

  protected reportHistogram(histogram: Histogram, ctx: LoggerReportingContext<Histogram>): LogLine {
    if (!isNaN(histogram.getCount())) {
      const name = histogram.getName()
      const snapshot = histogram.getSnapshot()

      ctx.logMetadata.measurement = name
      ctx.logMetadata.group = histogram.getGroup()
      ctx.logMetadata.tags = this.buildTags(ctx.registry, histogram)
      return {
        message: `${ctx.date} - histogram ${name}\
                          \n\tcount: ${histogram.getCount()}\
                          \n\tmax: ${this.getNumber(snapshot.getMax())}\
                          \n\tmean: ${this.getNumber(snapshot.getMean())}\
                          \n\tmin: ${this.getNumber(snapshot.getMin())}\
                          \n\tp50: ${this.getNumber(snapshot.getMedian())}\
                          \n\tp75: ${this.getNumber(snapshot.get75thPercentile())}\
                          \n\tp95: ${this.getNumber(snapshot.get95thPercentile())}\
                          \n\tp98: ${this.getNumber(snapshot.get98thPercentile())}\
                          \n\tp99: ${this.getNumber(snapshot.get99thPercentile())}\
                          \n\tp999: ${this.getNumber(snapshot.get999thPercentile())}\
                          \n\tstddev: ${this.getNumber(snapshot.getStdDev())}`,
        metadata: Object.assign({}, ctx.logMetadata),
      }
    }
    return null
  }

  protected reportMeter(meter: Meter, ctx: LoggerReportingContext<Meter>): LogLine {
    if (!isNaN(meter.getCount())) {
      const name = meter.getName()

      ctx.logMetadata.measurement = name
      ctx.logMetadata.group = meter.getGroup()
      ctx.logMetadata.tags = this.buildTags(ctx.registry, meter)
      return {
        message: `${ctx.date} - meter ${name}\
                          \n\tcount: ${meter.getCount()}\
                          \n\tm15_rate: ${this.getNumber(meter.get15MinuteRate())}\
                          \n\tm5_rate: ${this.getNumber(meter.get5MinuteRate())}\
                          \n\tm1_rate: ${this.getNumber(meter.get1MinuteRate())}\
                          \n\tmean_rate: ${this.getNumber(meter.getMeanRate())}`,
        metadata: Object.assign({}, ctx.logMetadata),
      }
    }
    return null
  }

  protected reportTimer(timer: Timer, ctx: LoggerReportingContext<Timer>): LogLine {
    if (!isNaN(timer.getCount())) {
      const name = timer.getName()
      const snapshot = timer.getSnapshot()

      ctx.logMetadata.measurement = name
      ctx.logMetadata.group = timer.getGroup()
      ctx.logMetadata.tags = this.buildTags(ctx.registry, timer)
      return {
        message: `${ctx.date} - timer ${name}\
                          \n\tcount: ${timer.getCount()}\
                          \n\tm15_rate: ${this.getNumber(timer.get15MinuteRate())}\
                          \n\tm5_rate: ${this.getNumber(timer.get5MinuteRate())}\
                          \n\tm1_rate: ${this.getNumber(timer.get1MinuteRate())}\
                          \n\tmean_rate: ${this.getNumber(timer.getMeanRate())}\
                          \n\tmax: ${this.getNumber(snapshot.getMax())}\
                          \n\tmean: ${this.getNumber(snapshot.getMean())}\
                          \n\tmin: ${this.getNumber(snapshot.getMin())}\
                          \n\tp50: ${this.getNumber(snapshot.getMedian())}\
                          \n\tp75: ${this.getNumber(snapshot.get75thPercentile())}\
                          \n\tp95: ${this.getNumber(snapshot.get95thPercentile())}\
                          \n\tp98: ${this.getNumber(snapshot.get98thPercentile())}\
                          \n\tp99: ${this.getNumber(snapshot.get99thPercentile())}\
                          \n\tp999: ${this.getNumber(snapshot.get999thPercentile())}\
                          \n\tstddev: ${this.getNumber(snapshot.getStdDev())}`,
        metadata: Object.assign({}, ctx.logMetadata),
      }
    }

    return null
  }
}
