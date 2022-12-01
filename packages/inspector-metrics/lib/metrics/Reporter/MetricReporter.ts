import "source-map-support/register"

import * as cluster from "cluster"
import { Counter, MonotoneCounter } from "../Counter"
import { Event } from "../Event"
import { Gauge } from "../Gauge"
import { Histogram } from "../Histogram"
import { Meter } from "../Meter"
import { MetricRegistry } from "../MetricRegistry"
import { getMetricTags, Metric } from "../Models/Metric"
import { Taggable, Tags, tagsToMap } from "../Models/Taggable"
import { MILLISECOND, MINUTE } from "../Models/TimeUnit"
import { Timer } from "../Timer"
import { InterprocessMessage, InterprocessReportMessage } from "./InterprocessMessage"
import { MetricEntry } from "./MetricEntry"
import { MetricReporterOptions } from "./MetricReporterOptions"
import { MetricSetReportContext } from "./MetricSetReportContext"
import { MetricType } from "./MetricType"
import { OverallReportContext } from "./OverallReportContext"
import { ReportingResult } from "./ReportingResult"

export interface IMetricReporter {
  getTags(): Map<string, string>
  setTags(tags: Map<string, string>): this
  start(): Promise<this>
  stop(): Promise<this>
  addMetricRegistry(metricRegistry: MetricRegistry): this
  removeMetricRegistry(metricRegistry: MetricRegistry): this
  reportEvent<TEventData, TEvent extends Event<TEventData>>(event: TEvent): Promise<TEvent>
  flushEvents(): Promise<void>
}

class TagsOnlyMetricRegistry {
  private tags: Map<string, string>

  public constructor(tags: Tags) {
    this.tags = tagsToMap(tags)
  }

  public getTags(): Map<string, string> {
    return this.tags
  }
}

export abstract class MetricReporter<O extends MetricReporterOptions, T> implements IMetricReporter {
  public static readonly MESSAGE_TYPE = "inspector-metrics:metric-reporter:report"

  protected readonly metricRegistries: MetricRegistry[] = []
  protected readonly options: O
  protected readonly metricStates: Map<number, MetricEntry> = new Map()
  protected readonly reporterType: string

  public constructor(options: O, reporterType?: string) {
    this.options = options
    this.reporterType = reporterType || this.constructor.name
    const clusterOptions = this.options.clusterOptions
    if (clusterOptions &&
      clusterOptions.enabled &&
      !clusterOptions.sendMetricsToMaster) {
      clusterOptions.eventReceiver.on("message", (worker, message, handle) =>
        this.handleReportMessage(worker, message, handle))
    }
  }

  public getTags(): Map<string, string> {
    return this.options.tags
  }

  public setTags(tags: Map<string, string>): this {
    this.options.tags = tags
    return this
  }

  public abstract start(): Promise<this>

  public abstract stop(): Promise<this>

  public addMetricRegistry(metricRegistry: MetricRegistry): this {
    this.metricRegistries.push(metricRegistry)
    return this
  }

  public removeMetricRegistry(metricRegistry: MetricRegistry): this {
    const index: number = this.metricRegistries.indexOf(metricRegistry)
    if (index > -1) {
      this.metricRegistries.splice(index, 1)
    }
    return this
  }

  public async reportEvent<TEventData, TEvent extends Event<TEventData>>(event: TEvent): Promise<TEvent> {
    return event
  }

  public async flushEvents(): Promise<void> {
  }

  protected canHandleMessage(
    message: InterprocessMessage,
    targetType: string = MetricReporter.MESSAGE_TYPE): boolean {
    return message &&
      message.type && message.type === targetType &&
      message.targetReporterType && message.targetReporterType === this.reporterType
  }

  protected async handleReportMessage(worker: cluster.Worker, message: any, handle: any) {
    if (this.canHandleMessage(message)) {
      const report: InterprocessReportMessage<T> = message
      const reg: MetricRegistry = (new TagsOnlyMetricRegistry(report.tags) as any) as MetricRegistry
      await this.handleResults(report.ctx, reg, report.date, "counter", report.metrics.monotoneCounters)
      await this.handleResults(report.ctx, reg, report.date, "counter", report.metrics.counters)
      await this.handleResults(report.ctx, reg, report.date, "gauge", report.metrics.gauges)
      await this.handleResults(report.ctx, reg, report.date, "histogram", report.metrics.histograms)
      await this.handleResults(report.ctx, reg, report.date, "meter", report.metrics.meters)
      await this.handleResults(report.ctx, reg, report.date, "timer", report.metrics.timers)
    }
  }

  protected async beforeReport(ctx: OverallReportContext) {
  }

  protected async afterReport(ctx: OverallReportContext) {
  }

  protected async report(): Promise<OverallReportContext> {
    if (this.metricRegistries && this.metricRegistries.length > 0) {
      const ctx = this.createOverallReportContext()
      await this.beforeReport(ctx)
      for (const registry of this.metricRegistries) {
        await this.reportMetricRegistry(ctx, registry)
      }
      await this.afterReport(ctx)
      return ctx
    }
    return {}
  }

  protected async reportMetricRegistry(
    ctx: OverallReportContext,
    registry: MetricRegistry | null) {

    const date: Date = new Date(this.options.clock.time().milliseconds)
    const counterCtx: MetricSetReportContext<MonotoneCounter | Counter> = this
      .createMetricSetReportContext(ctx, registry, date, "counter")
    const gaugeCtx: MetricSetReportContext<Gauge<any>> = this
      .createMetricSetReportContext(ctx, registry, date, "gauge")
    const histogramCtx: MetricSetReportContext<Histogram> = this
      .createMetricSetReportContext(ctx, registry, date, "histogram")
    const meterCtx: MetricSetReportContext<Meter> = this
      .createMetricSetReportContext(ctx, registry, date, "meter")
    const timerCtx: MetricSetReportContext<Timer> = this
      .createMetricSetReportContext(ctx, registry, date, "timer")

    counterCtx.metrics = registry.getMonotoneCounterList()
    const monotoneCounterResults = this.reportMetrics(ctx, counterCtx,
      (counter: MonotoneCounter) => this.reportCounter(counter, counterCtx),
      (counter: MonotoneCounter) => counter.getCount())

    counterCtx.metrics = registry.getCounterList()
    const counterResults = this.reportMetrics(ctx, counterCtx as MetricSetReportContext<Counter>,
      (counter: Counter) => this.reportCounter(counter, counterCtx),
      (counter: Counter) => counter.getCount())

    gaugeCtx.metrics = registry.getGaugeList()
    const gaugeResults = this.reportMetrics(ctx, gaugeCtx,
      (gauge: Gauge<any>) => this.reportGauge(gauge, gaugeCtx),
      (gauge: Gauge<any>) => gauge.getValue())

    histogramCtx.metrics = registry.getHistogramList()
    const histogramResults = this.reportMetrics(ctx, histogramCtx,
      (histogram: Histogram) => this.reportHistogram(histogram, histogramCtx),
      (histogram: Histogram) => histogram.getCount())

    meterCtx.metrics = registry.getMeterList()
    const meterResults = this.reportMetrics(ctx, meterCtx,
      (meter: Meter) => this.reportMeter(meter, meterCtx),
      (meter: Meter) => meter.getCount())

    timerCtx.metrics = registry.getTimerList()
    const timerResults = this.reportMetrics(ctx, timerCtx,
      (timer: Timer) => this.reportTimer(timer, timerCtx),
      (timer: Timer) => timer.getCount())

    if (this.sendMetricsToMaster()) {
      const message: InterprocessReportMessage<T> = {
        ctx,
        date,
        metrics: {
          counters: counterResults,
          gauges: gaugeResults,
          histograms: histogramResults,
          meters: meterResults,
          monotoneCounters: monotoneCounterResults,
          timers: timerResults,
        },
        tags: this.buildTags(registry, null),
        targetReporterType: this.reporterType,
        type: MetricReporter.MESSAGE_TYPE,
      }
      this.options.clusterOptions.sendToMaster(message)
    } else {
      await this.handleResults(ctx, registry, date, "counter", monotoneCounterResults)
      await this.handleResults(ctx, registry, date, "counter", counterResults)
      await this.handleResults(ctx, registry, date, "gauge", gaugeResults)
      await this.handleResults(ctx, registry, date, "histogram", histogramResults)
      await this.handleResults(ctx, registry, date, "meter", meterResults)
      await this.handleResults(ctx, registry, date, "timer", timerResults)
    }
  }

  protected sendMetricsToMaster(): boolean {
    return this.options.clusterOptions &&
      this.options.clusterOptions.enabled &&
      this.options.clusterOptions.sendMetricsToMaster
  }

  protected createOverallReportContext(): OverallReportContext {
    return {
    }
  }

  protected createMetricSetReportContext(
    overallCtx: OverallReportContext,
    registry: MetricRegistry | null,
    date: Date,
    type: MetricType): MetricSetReportContext<any> {
    return {
      date,
      metrics: [],
      overallCtx,
      registry,
      type,
    }
  }

  protected reportMetrics<M extends Metric, C extends MetricSetReportContext<M>>(
    overallCtx: OverallReportContext,
    ctx: C,
    reportFunction: (metric: M, ctx: C) => T,
    lastModifiedFunction: (metric: M, ctx: C) => number): Array<ReportingResult<M, T>> {

    return ctx.metrics
      .filter((metric) => {
        const metricId = (metric as any).id
        return !metricId || this.hasChanged(metricId, lastModifiedFunction(metric, ctx), ctx.date.getTime())
      })
      .map((metric) => ({
        metric,
        result: reportFunction(metric, ctx),
      }))
      .filter((result) => !!result.result)
  }

  protected abstract handleResults(
    ctx: OverallReportContext,
    registry: MetricRegistry | null,
    date: Date,
    type: MetricType,
    results: Array<ReportingResult<any, T>>): Promise<void>

  protected abstract reportCounter(
    counter: MonotoneCounter | Counter, ctx: MetricSetReportContext<MonotoneCounter | Counter>): T

  protected abstract reportGauge(gauge: Gauge<any>, ctx: MetricSetReportContext<Gauge<any>>): T

  protected abstract reportHistogram(histogram: Histogram, ctx: MetricSetReportContext<Histogram>): T

  protected abstract reportMeter(meter: Meter, ctx: MetricSetReportContext<Meter>): T

  protected abstract reportTimer(timer: Timer, ctx: MetricSetReportContext<Timer>): T

  protected hasChanged(metricId: number, lastValue: number, date: number): boolean {
    let changed = true
    let metricEntry = {
      lastReport: 0,
      lastValue,
    }
    if (this.metricStates.has(metricId)) {
      metricEntry = this.metricStates.get(metricId)
      changed = metricEntry.lastValue !== lastValue
      if (!changed) {
        const minReportingTimeout = MINUTE.convertTo(this.options.minReportingTimeout, MILLISECOND)
        changed = metricEntry.lastReport + minReportingTimeout < date
      }
    }
    if (changed) {
      metricEntry.lastReport = date
      metricEntry.lastValue = lastValue
    }
    this.metricStates.set(metricId, metricEntry)
    return changed
  }

  protected buildTags(registry: MetricRegistry | null, taggable: Taggable): Tags {
    const tags: Tags = {}
    if (this.options.tags) {
      this.options.tags.forEach((tag, key) => tags[key] = tag)
    }
    if (registry && registry.getTags()) {
      registry.getTags().forEach((tag, key) => tags[key] = tag)
    }
    if (taggable) {
      const customTags = getMetricTags(taggable)
      Object.keys(customTags).forEach((key) => tags[key] = customTags[key])
    }
    return tags
  }

  protected getNumber(value: number): number {
    if (isNaN(value)) {
      return 0
    }
    return value
  }
}
