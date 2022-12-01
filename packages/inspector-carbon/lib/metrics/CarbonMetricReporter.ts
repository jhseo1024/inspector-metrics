import 'source-map-support/register'

import {
  Counter,
  DefaultClusterOptions,
  Event,
  Gauge,
  Histogram,
  Logger,
  Meter,
  Metric,
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
  Tags,
  Timer
} from 'inspector-metrics'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const graphite = require('graphite')

export interface CarbonMetricReporterOptions extends ScheduledMetricReporterOptions {
  readonly host: string
  log: Logger
}

export interface CarbonData {
  measurement: any
  tags: Tags
}

export class CarbonMetricReporter extends ScheduledMetricReporter<CarbonMetricReporterOptions, CarbonData> {
  private readonly logMetadata: any
  private client: any

  public constructor({
    host,
    log = console,
    reportInterval = 1000,
    unit = MILLISECOND,
    clock = new StdClock(),
    scheduler = setInterval,
    minReportingTimeout = 1,
    tags = new Map(),
    clusterOptions = new DefaultClusterOptions()
  }: CarbonMetricReporterOptions,
    reporterType?: string) {
    super({
      clock,
      clusterOptions,
      host,
      log,
      minReportingTimeout,
      reportInterval,
      scheduler,
      tags,
      unit
    }, reporterType)

    this.logMetadata = {
      reportInterval,
      tags,
      unit
    }
  }

  public getLog(): Logger {
    return this.options.log
  }

  public setLog(log: Logger): void {
    this.options.log = log
  }

  public async reportEvent<TEventData, TEvent extends Event<TEventData>>(event: TEvent): Promise<TEvent> {
    const result = this.reportGauge(event, {
      date: event.getTime(),
      metrics: [],
      overallCtx: null,
      registry: null,
      type: 'gauge'
    })

    if (result) {
      await this.handleResults(
        this.createOverallReportContext(),
        null,
        event.getTime(),
        'gauge',
        [{
          metric: event,
          result
        }]
      )
    }

    return event
  }

  public async flushEvents(): Promise<void> {
    // Do nothing.
  }

  public async start(): Promise<this> {
    this.client = graphite.createClient(this.options.host)
    return await super.start()
  }

  public async stop(): Promise<this> {
    await super.stop()
    if (this.client) {
      await this.client.end()
    }
    return this
  }

  protected async handleResults(
    ctx: OverallReportContext,
    registry: MetricRegistry | null,
    timestamp: Date,
    type: MetricType,
    results: Array<ReportingResult<any, CarbonData>>): Promise<void> {
    await Promise.all(results
      .map((result) => result.result)
      .map(async (carbonData) => await new Promise<void>((resolve, reject) => {
        // can happen during serialization
        if (!(timestamp instanceof Date)) {
          timestamp = new Date(timestamp)
        }
        this.client.writeTagged(carbonData.measurement, carbonData.tags, timestamp, (err: any) => {
          if (err != null) {
            if (this.options.log) {
              this.options.log.error(err, this.logMetadata)
            }
            reject(err)
            return
          }
          resolve()
        })
      }).catch((err) => {
        if (this.options.log) {
          this.options.log.error(err, this.logMetadata)
        }
      })))
  }

  protected reportCounter(
    counter: MonotoneCounter | Counter,
    ctx: MetricSetReportContext<MonotoneCounter | Counter>): CarbonData {
    const value = counter.getCount()
    if (!value || isNaN(value)) {
      return null
    }
    const tags = this.buildTags(ctx.registry, counter)
    tags.group = counter.getGroup()
    tags.name = counter.getName()

    const prefix = this.getMetricName(counter)
    const measurement: any = {}
    measurement[`${prefix}.count`] = counter.getCount() || 0

    return {
      measurement,
      tags
    }
  }

  protected reportGauge(gauge: Gauge<any>, ctx: MetricSetReportContext<Gauge<any>>): CarbonData {
    const value = gauge.getValue()
    if (!value || isNaN(value)) {
      return null
    }
    const tags = this.buildTags(ctx.registry, gauge)
    tags.group = gauge.getGroup()
    tags.name = gauge.getName()

    const prefix = this.getMetricName(gauge)
    const measurement: any = {}
    measurement[`${prefix}.value`] = gauge.getValue() || 0

    return {
      measurement,
      tags
    }
  }

  protected reportHistogram(histogram: Histogram, ctx: MetricSetReportContext<Histogram>): CarbonData {
    const value = histogram.getCount()
    if (!value || isNaN(value)) {
      return null
    }
    const snapshot = histogram.getSnapshot()
    const tags = this.buildTags(ctx.registry, histogram)
    tags.group = histogram.getGroup()
    tags.name = histogram.getName()

    const prefix = this.getMetricName(histogram)
    const measurement: any = {}
    measurement[`${prefix}.count`] = histogram.getCount() || 0
    measurement[`${prefix}.max`] = this.getNumber(snapshot.getMax())
    measurement[`${prefix}.mean`] = this.getNumber(snapshot.getMean())
    measurement[`${prefix}.min`] = this.getNumber(snapshot.getMin())
    measurement[`${prefix}.p50`] = this.getNumber(snapshot.getMedian())
    measurement[`${prefix}.p75`] = this.getNumber(snapshot.get75thPercentile())
    measurement[`${prefix}.p95`] = this.getNumber(snapshot.get95thPercentile())
    measurement[`${prefix}.p98`] = this.getNumber(snapshot.get98thPercentile())
    measurement[`${prefix}.p99`] = this.getNumber(snapshot.get99thPercentile())
    measurement[`${prefix}.p999`] = this.getNumber(snapshot.get999thPercentile())
    measurement[`${prefix}.stddev`] = this.getNumber(snapshot.getStdDev())

    return {
      measurement,
      tags
    }
  }

  protected reportMeter(meter: Meter, ctx: MetricSetReportContext<Meter>): CarbonData {
    const value = meter.getCount()
    if (value === undefined || value === null || isNaN(value)) {
      return null
    }
    const tags = this.buildTags(ctx.registry, meter)
    tags.group = meter.getGroup()
    tags.name = meter.getName()

    const prefix = this.getMetricName(meter)
    const measurement: any = {}
    measurement[`${prefix}.count`] = meter.getCount() || 0
    measurement[`${prefix}.m15_rate`] = this.getNumber(meter.get15MinuteRate())
    measurement[`${prefix}.m1_rate`] = this.getNumber(meter.get1MinuteRate())
    measurement[`${prefix}.m5_rate`] = this.getNumber(meter.get5MinuteRate())
    measurement[`${prefix}.mean_rate`] = this.getNumber(meter.getMeanRate())

    return {
      measurement,
      tags: this.buildTags(ctx.registry, meter)
    }
  }

  protected reportTimer(timer: Timer, ctx: MetricSetReportContext<Timer>): CarbonData {
    const value = timer.getCount()
    if (!value || isNaN(value)) {
      return null
    }
    const snapshot = timer.getSnapshot()
    const tags = this.buildTags(ctx.registry, timer)
    tags.group = timer.getGroup()
    tags.name = timer.getName()

    const prefix = this.getMetricName(timer)
    const measurement: any = {}
    measurement[`${prefix}.count`] = timer.getCount() || 0
    measurement[`${prefix}.m15_rate`] = this.getNumber(timer.get15MinuteRate())
    measurement[`${prefix}.m1_rate`] = this.getNumber(timer.get1MinuteRate())
    measurement[`${prefix}.m5_rate`] = this.getNumber(timer.get5MinuteRate())
    measurement[`${prefix}.max`] = this.getNumber(snapshot.getMax())
    measurement[`${prefix}.mean`] = this.getNumber(snapshot.getMean())
    measurement[`${prefix}.mean_rate`] = this.getNumber(timer.getMeanRate())
    measurement[`${prefix}.min`] = this.getNumber(snapshot.getMin())
    measurement[`${prefix}.p50`] = this.getNumber(snapshot.getMedian())
    measurement[`${prefix}.p75`] = this.getNumber(snapshot.get75thPercentile())
    measurement[`${prefix}.p95`] = this.getNumber(snapshot.get95thPercentile())
    measurement[`${prefix}.p98`] = this.getNumber(snapshot.get98thPercentile())
    measurement[`${prefix}.p99`] = this.getNumber(snapshot.get99thPercentile())
    measurement[`${prefix}.p999`] = this.getNumber(snapshot.get999thPercentile())
    measurement[`${prefix}.stddev`] = this.getNumber(snapshot.getStdDev())

    return {
      measurement,
      tags: this.buildTags(ctx.registry, timer)
    }
  }

  protected getMetricName(metric: Metric): string {
    if (metric.getGroup()) {
      return `${metric.getGroup()}.${metric.getName()}`
    }
    return metric.getName()
  }
}
