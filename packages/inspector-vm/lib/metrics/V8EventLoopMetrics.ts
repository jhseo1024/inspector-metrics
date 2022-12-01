import 'source-map-support/register'

import {
  BaseMetric,
  Metric,
  MetricSet,
  Scheduler,
  SimpleGauge
} from 'inspector-metrics'

export class V8EventLoopMetrics extends BaseMetric implements MetricSet {
  private readonly metrics: Metric[] = []
  private readonly eventLoopLag: SimpleGauge
  private readonly timer: NodeJS.Timer

  public constructor(name: string, scheduler: Scheduler = setInterval) {
    super()

    this.name = name

    this.eventLoopLag = new SimpleGauge(
      'lag',
      'measures the duration between committing a function to the event loop and the function being executed'
    )

    this.metrics.push(this.eventLoopLag)
    this.timer = scheduler(async () => {
      setImmediate((start) => this.reportEventloopLag(start), process.hrtime())
    }, 500)
  }

  public stop(): void {
    if (this.timer) {
      this.timer.unref()
    }
  }

  public getMetrics(): Map<string, Metric> {
    const map: Map<string, Metric> = new Map()
    this.metrics.forEach((metric) => map.set(metric.getName(), metric))
    return map
  }

  public getMetricList(): Metric[] {
    return this.metrics
  }

  public setGroup(group: string): this {
    this.group = group
    this.eventLoopLag.setGroup(group)
    return this
  }

  public setTag(name: string, value: string): this {
    this.tagMap.set(name, value)
    this.eventLoopLag.setTag(name, value)
    return this
  }

  public removeTag(name: string): this {
    this.tagMap.delete(name)
    this.eventLoopLag.removeTag(name)
    return this
  }

  private reportEventloopLag(start: [number, number]): void {
    const delta = process.hrtime(start)
    const nanosec = delta[0] * 1e9 + delta[1]
    this.eventLoopLag.setValue(nanosec)
  }
}
