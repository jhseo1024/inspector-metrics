import 'source-map-support/register'

import { Clock, diff, Time } from './Clock'
import { Metered, MeteredRates, SerializableMetered } from './Models/Metered'
import { BaseMetric } from './Models/Metric'
import { ExponentiallyWeightedMovingAverage, MovingAverage } from './Models/MovingAverage'
import { NANOSECOND, SECOND } from './Models/TimeUnit'

export class Meter extends BaseMetric implements Metered, SerializableMetered {
  private static readonly AVG_1_MINUTE = ExponentiallyWeightedMovingAverage.ALPHA_1_MINUTE_1_SECOND_SAMPLERATE
  private static readonly AVG_5_MINUTE = ExponentiallyWeightedMovingAverage.ALPHA_5_MINUTE_1_SECOND_SAMPLERATE
  private static readonly AVG_15_MINUTE = ExponentiallyWeightedMovingAverage.ALPHA_15_MINUTE_1_SECOND_SAMPLERATE
  private static readonly SECOND_1_NANOS = SECOND.convertTo(1, NANOSECOND)
  private readonly clock: Clock
  private readonly startTime: Time
  private lastTime: Time
  private countInternal: number = 0
  private readonly sampleRate: number
  private readonly interval: number
  private readonly avg1Minute: MovingAverage = new ExponentiallyWeightedMovingAverage(Meter.AVG_1_MINUTE, 1, SECOND)
  private readonly avg5Minute: MovingAverage = new ExponentiallyWeightedMovingAverage(Meter.AVG_5_MINUTE, 1, SECOND)
  private readonly avg15Minute: MovingAverage = new ExponentiallyWeightedMovingAverage(Meter.AVG_15_MINUTE, 1, SECOND)

  public constructor(clock: Clock, sampleRate: number, name?: string, description?: string) {
    super()

    this.name = name
    this.description = description
    this.clock = clock
    this.startTime = clock.time()
    this.lastTime = this.startTime
    this.sampleRate = sampleRate
    this.interval = Meter.SECOND_1_NANOS / this.sampleRate
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

  public mark(value: number): this {
    this.tickIfNeeded()
    this.countInternal += value
    this.avg15Minute.update(value)
    this.avg5Minute.update(value)
    this.avg1Minute.update(value)
    return this
  }

  public getCount(): number {
    return this.countInternal
  }

  public get15MinuteRate(): number {
    this.tickIfNeeded()
    return this.avg15Minute.getAverage(SECOND)
  }

  public get5MinuteRate(): number {
    this.tickIfNeeded()
    return this.avg5Minute.getAverage(SECOND)
  }

  public get1MinuteRate(): number {
    this.tickIfNeeded()
    return this.avg1Minute.getAverage(SECOND)
  }

  public getMeanRate(): number {
    if (this.countInternal === 0) {
      return 0.0
    } else {
      const elapsed: number = diff(this.startTime, this.clock.time())
      return this.countInternal / elapsed * Meter.SECOND_1_NANOS
    }
  }

  public toJSON(): any {
    const json = super.toJSON()
    json.count = this.countInternal
    json.meanRate = this.meanRate
    json.rates = this.rates
    return json
  }

  private tick(ticks: number): void {
    while (ticks-- > 0) {
      this.avg15Minute.tick()
      this.avg5Minute.tick()
      this.avg1Minute.tick()
    }
  }

  private tickIfNeeded(): void {
    const currentTime: Time = this.clock.time()
    const age: number = diff(this.lastTime, currentTime)
    if (age > this.interval) {
      this.lastTime = currentTime
      this.tick(Math.floor(age / this.interval))
    }
  }
}
