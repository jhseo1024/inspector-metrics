import 'source-map-support/register'

import { Client } from '@elastic/elasticsearch'
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

export type MetricInfoDeterminator =
  (registry: MetricRegistry, metric: Metric, type: MetricType, date: Date) => string

export type MetricDocumentBuilder = (
  registry: MetricRegistry,
  metric: Metric,
  type: MetricType,
  date: Date,
  tags: Tags) => {}

export interface ElasticsearchMetricReporterOption extends ScheduledMetricReporterOptions {
  readonly clientOptions: {}
  log?: Logger
  readonly indexnameDeterminator?: MetricInfoDeterminator
  readonly typeDeterminator?: MetricInfoDeterminator
  readonly metricDocumentBuilder?: MetricDocumentBuilder
}

export class ElasticsearchMetricReporter extends ScheduledMetricReporter<ElasticsearchMetricReporterOption, Array<{}>> {
  public static defaultTypeDeterminator(): MetricInfoDeterminator {
    return (registry: MetricRegistry, metric: Metric, type: MetricType, date: Date) => 'metric'
  }

  public static dailyIndex(baseName: string): MetricInfoDeterminator {
    return (registry: MetricRegistry, metric: Metric, type: MetricType, date: Date) => {
      const day = date.getDate()
      const dayPrefix: string = (day >= 10) ? '' : '0'
      const month = date.getMonth() + 1
      const monthPrefix: string = (month >= 10) ? '' : '0'
      return `${baseName}-${date.getFullYear()}-${monthPrefix}${month}-${dayPrefix}${day}`
    }
  }

  public static defaultDocumentBuilder(): MetricDocumentBuilder {
    return (
      registry: MetricRegistry,
      metric: Metric,
      type: MetricType,
      timestamp: Date,
      tags: Tags) => {
      let values = null

      if (metric instanceof MonotoneCounter) {
        values = ElasticsearchMetricReporter.getMonotoneCounterValues(metric)
      } else if (metric instanceof Counter) {
        values = ElasticsearchMetricReporter.getCounterValues(metric)
      } else if (metric instanceof Histogram) {
        values = ElasticsearchMetricReporter.getHistogramValues(metric)
      } else if (metric instanceof Meter) {
        values = ElasticsearchMetricReporter.getMeterValues(metric)
      } else if (metric instanceof Timer) {
        values = ElasticsearchMetricReporter.getTimerValues(metric)
      } else {
        values = ElasticsearchMetricReporter.getGaugeValue(metric as Gauge<any>)
      }

      if (values === null) {
        return null
      }

      const name = metric.getName()
      const group = metric.getGroup()
      return { name, group, tags, timestamp, values, type }
    }
  }

  public static getMonotoneCounterValues(counter: MonotoneCounter): {} {
    const count = counter.getCount()
    if (!count || isNaN(count)) {
      return null
    }
    return { count }
  }

  public static getCounterValues(counter: Counter): {} {
    const count = counter.getCount()
    if (!count || isNaN(count)) {
      return null
    }
    return { count }
  }

  public static getGaugeValue(gauge: Gauge<any>): {} {
    const value = gauge.getValue()
    if ((!value && value !== 0) || Number.isNaN(value)) {
      return null
    }
    if (typeof value === 'object') {
      return value
    }
    return { value }
  }

  public static getHistogramValues(histogram: Histogram): {} {
    const value = histogram.getCount()
    if (!value || isNaN(value)) {
      return null
    }
    const snapshot = histogram.getSnapshot()
    const values: any = {}

    values.count = value
    values.max = this.getNumber(snapshot.getMax())
    values.mean = this.getNumber(snapshot.getMean())
    values.min = this.getNumber(snapshot.getMin())
    values.p50 = this.getNumber(snapshot.getMedian())
    values.p75 = this.getNumber(snapshot.get75thPercentile())
    values.p95 = this.getNumber(snapshot.get95thPercentile())
    values.p98 = this.getNumber(snapshot.get98thPercentile())
    values.p99 = this.getNumber(snapshot.get99thPercentile())
    values.p999 = this.getNumber(snapshot.get999thPercentile())
    values.stddev = this.getNumber(snapshot.getStdDev())

    return values
  }

  public static getMeterValues(meter: Meter): {} {
    const value = meter.getCount()
    if (!value || isNaN(value)) {
      return null
    }
    const values: any = {}

    values.count = value
    values.m15_rate = this.getNumber(meter.get15MinuteRate())
    values.m1_rate = this.getNumber(meter.get1MinuteRate())
    values.m5_rate = this.getNumber(meter.get5MinuteRate())
    values.mean_rate = this.getNumber(meter.getMeanRate())

    return values
  }

  public static getTimerValues(timer: Timer): {} {
    const value = timer.getCount()
    if (!value || isNaN(value)) {
      return null
    }
    const snapshot = timer.getSnapshot()
    const values: any = {}

    values.count = value
    values.m15_rate = this.getNumber(timer.get15MinuteRate())
    values.m1_rate = this.getNumber(timer.get1MinuteRate())
    values.m5_rate = this.getNumber(timer.get5MinuteRate())
    values.max = this.getNumber(snapshot.getMax())
    values.mean = this.getNumber(snapshot.getMean())
    values.mean_rate = this.getNumber(timer.getMeanRate())
    values.min = this.getNumber(snapshot.getMin())
    values.p50 = this.getNumber(snapshot.getMedian())
    values.p75 = this.getNumber(snapshot.get75thPercentile())
    values.p95 = this.getNumber(snapshot.get95thPercentile())
    values.p98 = this.getNumber(snapshot.get98thPercentile())
    values.p99 = this.getNumber(snapshot.get99thPercentile())
    values.p999 = this.getNumber(snapshot.get999thPercentile())
    values.stddev = this.getNumber(snapshot.getStdDev())

    return values
  }

  private static getNumber(value: number): number {
    if (isNaN(value)) {
      return 0
    }
    return value
  }

  private readonly logMetadata: any
  private readonly client: Client

  public constructor(
    {
      clientOptions,
      metricDocumentBuilder = ElasticsearchMetricReporter.defaultDocumentBuilder(),
      indexnameDeterminator = ElasticsearchMetricReporter.dailyIndex('metric'),
      typeDeterminator = ElasticsearchMetricReporter.defaultTypeDeterminator(),
      log = console,
      reportInterval = 1000,
      unit = MILLISECOND,
      clock = new StdClock(),
      scheduler = setInterval,
      minReportingTimeout = 1,
      tags = new Map(),
      clusterOptions = new DefaultClusterOptions()
    }: ElasticsearchMetricReporterOption,
    reporterType?: string) {
    super({
      clientOptions,
      clock,
      clusterOptions,
      indexnameDeterminator,
      log,
      metricDocumentBuilder,
      minReportingTimeout,
      reportInterval,
      scheduler,
      tags,
      typeDeterminator,
      unit
    }, reporterType)

    this.logMetadata = {
      reportInterval,
      tags,
      unit
    }

    this.client = new Client(clientOptions)
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
      await this.handleResults(null, null, event.getTime(), 'gauge', [{
        metric: event,
        result
      }])
    }

    return event
  }

  public async flushEvents(): Promise<void> {
    // Do nothing.
  }

  protected async handleResults(
    ctx: OverallReportContext,
    registry: MetricRegistry | null,
    date: Date,
    type: MetricType,
    results: Array<ReportingResult<any, any[]>>): Promise<void> {
    const body = results
      .map((result) => result.result)
      .reduce((p, c) => p.concat(c), [])

    if (!body || body.length === 0) {
      return await Promise.resolve()
    }

    try {
      const response = await this.client.bulk({ body })
      if (this.options.log) {
        const warnings = response.warnings
        this.options.log.debug(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `wrote ${type} metrics - warnings ${warnings}`,
          this.logMetadata
        )
      }
    } catch (reason) {
      if (this.options.log) {
        const message = reason.message as string
        this.options.log
          .error(`error writing ${type} metrics - reason: ${message}`, reason, this.logMetadata)
      }
    }
  }

  protected reportMetric(
    metric: Metric, ctx: MetricSetReportContext<Metric>): Array<{}> {
    const document = this.options.metricDocumentBuilder(
      ctx.registry, metric, ctx.type, ctx.date, this.buildTags(ctx.registry, metric))
    if (document) {
      const _index = this.options.indexnameDeterminator(ctx.registry, metric, ctx.type, ctx.date)
      const _type = this.options.typeDeterminator(ctx.registry, metric, ctx.type, ctx.date)
      return [
        { index: { _index, _type } },
        document
      ]
    }
    return []
  }

  protected reportCounter(
    counter: MonotoneCounter | Counter, ctx: MetricSetReportContext<MonotoneCounter | Counter>): Array<{}> {
    return this.reportMetric(counter, ctx)
  }

  protected reportGauge(gauge: Gauge<any>, ctx: MetricSetReportContext<Gauge<any>>): Array<{}> {
    return this.reportMetric(gauge, ctx)
  }

  protected reportHistogram(histogram: Histogram, ctx: MetricSetReportContext<Histogram>): Array<{}> {
    return this.reportMetric(histogram, ctx)
  }

  protected reportMeter(meter: Meter, ctx: MetricSetReportContext<Meter>): Array<{}> {
    return this.reportMetric(meter, ctx)
  }

  protected reportTimer(timer: Timer, ctx: MetricSetReportContext<Timer>): Array<{}> {
    return this.reportMetric(timer, ctx)
  }
}
