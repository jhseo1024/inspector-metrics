import 'source-map-support'

import * as http from 'http'
import {
  Counter,
  DisabledClusterOptions,
  Event,
  Gauge,
  Histogram,
  Logger,
  Meter,
  MetricRegistry,
  MetricSetReportContext,
  MetricType,
  MILLISECOND,
  MonotoneCounter,
  OverallReportContext,
  ReportingResult,
  ScheduledMetricReporter,
  ScheduledMetricReporterOptions,
  StdClock,
  Timer
} from 'inspector-metrics'
import { PrometheusMetricReporter } from './PrometheusMetricReporter'

export interface PushgatewayReporterOptions extends ScheduledMetricReporterOptions {
  readonly host?: string
  readonly port?: number
  readonly job?: string
  readonly instance?: string
  readonly reporter?: PrometheusMetricReporter
  log?: Logger
}

export class PushgatewayMetricReporter extends ScheduledMetricReporter<PushgatewayReporterOptions, any> {
  public constructor({
    clock = new StdClock(),
    host = '',
    instance = '',
    job = '',
    log = console,
    minReportingTimeout = 1,
    port = 9091,
    reporter,
    reportInterval = 1000,
    scheduler = setInterval,
    tags = new Map(),
    unit = MILLISECOND,
    clusterOptions = new DisabledClusterOptions()
  }: PushgatewayReporterOptions,
    reporterType?: string) {
    super({
      clock,
      clusterOptions,
      host,
      instance,
      job,
      log,
      minReportingTimeout,
      port,
      reportInterval,
      reporter,
      scheduler,
      tags,
      unit
    }, reporterType)
  }

  public async reportEvent<TEventData, TEvent extends Event<TEventData>>(event: TEvent): Promise<TEvent> {
    const payload = await this.options.reporter.getEventString(event)
    this.sendPayload(payload)
    return event
  }

  public async flushEvents(): Promise<void> {
    // Do nothing.
  }

  protected async report(): Promise<OverallReportContext> {
    const ctx = this.createOverallReportContext()
    const payload = await this.options.reporter.getMetricsString()

    this.sendPayload(payload)

    ctx.result = payload
    return ctx
  }

  protected sendPayload(payload: string): void {
    const options = {
      headers: {
        'Content-Length': payload.length,
        'Content-Type': 'text/plain'
      },
      host: this.options.host,
      method: 'PUT',
      path: `/metrics/job/${this.options.job}/instance/${this.options.instance}`,
      port: `${this.options.port}`
    }

    const req = http.request(options, (res) => {
      if (this.options.log) {
        this.options.log.trace(`${res.statusCode} ${res.statusMessage}`)
      }
    })
    req.write(payload)
    req.end()
  }

  protected async handleResults(
    ctx: OverallReportContext,
    registry: MetricRegistry | null,
    date: Date,
    type: MetricType,
    results: Array<ReportingResult<any, any>>): Promise<any> {
  }

  protected reportCounter(
    counter: MonotoneCounter | Counter,
    ctx: MetricSetReportContext<MonotoneCounter | Counter>): void {
  }

  protected reportGauge(gauge: Gauge<any>, ctx: MetricSetReportContext<Gauge<any>>): void {
  }

  protected reportHistogram(histogram: Histogram, ctx: MetricSetReportContext<Histogram>): void {
  }

  protected reportMeter(meter: Meter, ctx: MetricSetReportContext<Meter>): void {
  }

  protected reportTimer(timer: Timer, ctx: MetricSetReportContext<Timer>): void {
  }
}
