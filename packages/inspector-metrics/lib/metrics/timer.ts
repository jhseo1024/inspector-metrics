import 'source-map-support/register'

import { Clock, diff, Time } from './Clock'
import { Histogram } from './Histogram'
import { Meter } from './Meter'
import { BucketCounting, Buckets, BucketToCountMap, SerializableBucketCounting } from './Models/Counting'
import { Int64Wrapper } from './Models/Int64'
import { Metered, MeteredRates, SerializableMetered } from './Models/Metered'
import { BaseMetric } from './Models/Metric'
import { Reservoir } from './Models/Reservoir'
import { Sampling, SerializableSampling } from './Models/Sampling'
import { SerializedSnapshot, Snapshot } from './Models/Snapshot'
import { SerializableSummarizing, Summarizing } from './Models/Summarizing'
import { NANOSECOND, TimeUnit } from './Models/TimeUnit'

export class StopWatch {
  private readonly clock: Clock
  private readonly timer: Timer
  private startTime: Time

  public constructor(clock: Clock, timer: Timer) {
    this.clock = clock
    this.timer = timer
  }

  public start(): this {
    this.startTime = this.clock.time()
    return this
  }

  public stop(): this {
    this.timer.addDuration(diff(this.startTime, this.clock.time()), NANOSECOND)
    return this
  }
}

export class Timer extends BaseMetric implements
  BucketCounting, Metered, Sampling, Summarizing,
  SerializableSummarizing, SerializableBucketCounting,
  SerializableSampling, SerializableMetered {
  private readonly clock: Clock
  private readonly meter: Meter
  private readonly histogram: Histogram

  public constructor(
    clock: Clock,
    reservoir: Reservoir,
    name?: string,
    description?: string,
    buckets: Buckets = new Buckets()) {
    super()
    this.clock = clock
    this.name = name
    this.description = description
    this.meter = new Meter(clock, 1, name)
    this.histogram = new Histogram(reservoir, name, description, buckets)
  }

  public get buckets(): number[] {
    return this.histogram.buckets
  }

  public get counts(): BucketToCountMap {
    return this.histogram.counts
  }

  public get sum(): string {
    return this.histogram.sum
  }

  public get snapshot(): SerializedSnapshot {
    return this.histogram.snapshot
  }

  public get count(): number {
    return this.getCount()
  }

  public get meanRate(): number {
    return this.getMeanRate()
  }

  public get rates(): MeteredRates {
    return {
      15: this.get15MinuteRate(),
      5: this.get5MinuteRate(),
      1: this.get1MinuteRate()
    }
  }

  public addDuration(duration: number, unit: TimeUnit): this {
    if (duration >= 0) {
      this.histogram.update(unit.convertTo(duration, NANOSECOND))
      this.meter.mark(1)
    }
    return this
  }

  public getSnapshot(): Snapshot {
    return this.histogram.getSnapshot()
  }

  public getCount(): number {
    return this.histogram.getCount()
  }

  public getSum(): Int64Wrapper {
    return this.histogram.getSum()
  }

  public get15MinuteRate(): number {
    return this.meter.get15MinuteRate()
  }

  public get5MinuteRate(): number {
    return this.meter.get5MinuteRate()
  }

  public get1MinuteRate(): number {
    return this.meter.get1MinuteRate()
  }

  public getMeanRate(): number {
    return this.meter.getMeanRate()
  }

  public getBuckets(): Buckets {
    return this.histogram.getBuckets()
  }

  public getCounts(): Map<number, number> {
    return this.histogram.getCounts()
  }

  public time<T>(f: () => T): T {
    const startTime: Time = this.clock.time()
    try {
      return f()
    } finally {
      this.addDuration(diff(startTime, this.clock.time()), NANOSECOND)
    }
  }

  public async timeAsync<T>(f: () => Promise<T>): Promise<T> {
    const startTime: Time = this.clock.time()
    return await f()
      .then((res) => {
        this.addDuration(diff(startTime, this.clock.time()), NANOSECOND)
        return res
      })
      .catch((err) => {
        this.addDuration(diff(startTime, this.clock.time()), NANOSECOND)
        throw err
      })
  }

  public newStopWatch(): StopWatch {
    return new StopWatch(this.clock, this)
  }

  public toJSON(): any {
    const json = super.toJSON()
    const histogramJson = this.histogram.toJSON()
    const meterJson = this.meter.toJSON()
    return {
      ...meterJson,
      ...histogramJson,
      ...json
    }
  }
}
