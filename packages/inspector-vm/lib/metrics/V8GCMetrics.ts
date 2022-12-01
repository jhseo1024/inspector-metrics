import 'source-map-support/register'

import { EventEmitter } from 'events'
import {
  BaseMetric,
  Clock,
  DefaultReservoir,
  Metric,
  MetricSet,
  NANOSECOND,
  Timer
} from 'inspector-metrics'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const GC = require('gc-stats')

export class V8GCMetrics extends BaseMetric implements MetricSet {
  private readonly metrics: Metric[] = []
  private readonly minorRuns: Timer
  private readonly majorRuns: Timer
  private readonly incrementalMarkingRuns: Timer
  private readonly phantomCallbackProcessingRuns: Timer
  private readonly allRuns: Timer
  private readonly gc: EventEmitter

  public constructor(name: string, clock: Clock) {
    super()

    this.name = name

    this.minorRuns = new Timer(clock, new DefaultReservoir(1024), 'runs')
    this.minorRuns.setTag('type', 'minor')

    this.majorRuns = new Timer(clock, new DefaultReservoir(1024), 'runs')
    this.majorRuns.setTag('type', 'major')

    this.incrementalMarkingRuns = new Timer(clock, new DefaultReservoir(1024), 'runs')
    this.incrementalMarkingRuns.setTag('type', 'IncrementalMarking')

    this.phantomCallbackProcessingRuns = new Timer(clock, new DefaultReservoir(1024), 'runs')
    this.phantomCallbackProcessingRuns.setTag('type', 'PhantomCallbackProcessing')

    this.allRuns = new Timer(clock, new DefaultReservoir(1024), 'runs')
    this.allRuns.setTag('type', 'all')

    this.metrics.push(this.allRuns)
    this.metrics.push(this.incrementalMarkingRuns)
    this.metrics.push(this.majorRuns)
    this.metrics.push(this.minorRuns)
    this.metrics.push(this.phantomCallbackProcessingRuns)

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const slf = this
    this.gc = GC()
    this.gc.on('stats', function (stats: any) {
      const duration = stats.pause

      switch (stats.gctype) {
        case 1:
          slf.minorRuns.addDuration(duration, NANOSECOND)
          break
        case 2:
          slf.majorRuns.addDuration(duration, NANOSECOND)
          break
        case 4:
          slf.incrementalMarkingRuns.addDuration(duration, NANOSECOND)
          break
        case 8:
          slf.phantomCallbackProcessingRuns.addDuration(duration, NANOSECOND)
          break
        case 15:
          slf.allRuns.addDuration(duration, NANOSECOND)
          break
      }
    })
  }

  public stop(): void {
    this.gc.removeAllListeners()
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
    this.allRuns.setGroup(group)
    this.incrementalMarkingRuns.setGroup(group)
    this.majorRuns.setGroup(group)
    this.minorRuns.setGroup(group)
    this.phantomCallbackProcessingRuns.setGroup(group)
    return this
  }

  public setTag(name: string, value: string): this {
    this.tagMap.set(name, value)
    this.allRuns.setTag(name, value)
    this.incrementalMarkingRuns.setTag(name, value)
    this.majorRuns.setTag(name, value)
    this.minorRuns.setTag(name, value)
    this.phantomCallbackProcessingRuns.setTag(name, value)
    return this
  }

  public removeTag(name: string): this {
    this.tagMap.delete(name)
    this.allRuns.removeTag(name)
    this.incrementalMarkingRuns.removeTag(name)
    this.majorRuns.removeTag(name)
    this.minorRuns.removeTag(name)
    this.phantomCallbackProcessingRuns.removeTag(name)
    return this
  }
}
