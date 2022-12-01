import 'source-map-support/register'

import { Clock, StdClock } from './Clock'
import { Counter, MonotoneCounter } from './Counter'
import { Gauge } from './Gauge'
import { HdrHistogram } from './HdrHistogram'
import { Histogram } from './Histogram'
import { Meter } from './Meter'
import { MetricRegistryListener } from './MetricRegistryListener'
import { MetricSet } from './MetricSet'
import { Buckets } from './Models/Counting'
import { BaseMetric, Metric } from './Models/Metric'
import { Reservoir, SlidingWindowReservoir } from './Models/Reservoir'
import { Timer } from './Timer'

export type NameFactory = (baseName: string, metricName: string, metric: Metric) => string

export class MetricRegistryListenerRegistration {
  public constructor(private readonly listener: MetricRegistryListener, private readonly registry: MetricRegistry) { }

  public remove(): this {
    this.registry.removeListener(this.listener)
    return this
  }
}

export class MetricRegistration<T extends Metric> {
  public metricRef: T
  public name: string

  public constructor(metricRef: T) {
    this.metricRef = metricRef
    this.name = metricRef.getName()
  }
}

export class MetricRegistry extends BaseMetric implements MetricSet {
  public static isCounter(instance: any): instance is Counter {
    return instance instanceof Counter || instance.metricRef instanceof Counter
  }

  public static isMonotoneCounter(instance: any): instance is MonotoneCounter {
    return instance instanceof MonotoneCounter || instance.metricRef instanceof MonotoneCounter
  }

  public static isPureMonotoneCounter(instance: any): instance is MonotoneCounter {
    return (instance instanceof MonotoneCounter || instance.metricRef instanceof MonotoneCounter) &&
      !MetricRegistry.isCounter(instance)
  }

  public static isHistogram(instance: any): instance is Histogram {
    return instance instanceof Histogram || instance.metricRef instanceof Histogram
  }

  public static isMeter(instance: any): instance is Meter {
    return instance instanceof Meter || instance.metricRef instanceof Meter
  }

  public static isTimer(instance: any): instance is Timer {
    return instance instanceof Timer || instance.metricRef instanceof Timer
  }

  public static isGauge<T>(instance: any): instance is Gauge<T> {
    const directGauge: boolean = !!instance.getValue && instance.getValue instanceof Function
    const gaugeRegistration = !!instance.metricRef &&
      !!instance.metricRef.getValue &&
      instance.metricRef.getValue instanceof Function
    return directGauge || gaugeRegistration
  }

  public static isMetricSet(instance: any): instance is MetricSet {
    return !!instance.getMetrics && instance.getMetrics instanceof Function
  }

  private static defaultNameFactory(baseName: string, metricName: string, metric: Metric): string {
    return baseName + '.' + metricName
  }

  private defaultClock: Clock = new StdClock()
  private readonly metrics: Array<MetricRegistration<Metric>> = []
  private nameFactory: NameFactory = MetricRegistry.defaultNameFactory
  private readonly listeners: MetricRegistryListener[] = []

  public addListener(listener: MetricRegistryListener): MetricRegistryListenerRegistration {
    this.listeners.push(listener)
    return new MetricRegistryListenerRegistration(listener, this)
  }

  public removeListener(listener: MetricRegistryListener): this {
    const index = this.listeners.indexOf(listener)
    if (index > -1) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete this.listeners[index]
    }
    return this
  }

  public setNameFactory(nameFactory: NameFactory): this {
    this.nameFactory = nameFactory
    return this
  }

  public getDefaultClock(): Clock {
    return this.defaultClock
  }

  public setDefaultClock(defaultClock: Clock): this {
    this.defaultClock = defaultClock
    return this
  }

  public getCounterList(): Counter[] {
    return this.metrics
      .filter(MetricRegistry.isCounter)
      .map((registration) => registration.metricRef as Counter)
  }

  public getMonotoneCounterList(): MonotoneCounter[] {
    return this.metrics
      .filter(MetricRegistry.isPureMonotoneCounter)
      .map((registration) => registration.metricRef as MonotoneCounter)
  }

  public getGaugeList(): Array<Gauge<any>> {
    return this.metrics
      .filter(MetricRegistry.isGauge)
      .map((registration) => registration.metricRef as Gauge<any>)
  }

  public getHistogramList(): Histogram[] {
    return this.metrics
      .filter(MetricRegistry.isHistogram)
      .map((registration) => registration.metricRef as Histogram)
  }

  public getMeterList(): Meter[] {
    return this.metrics
      .filter(MetricRegistry.isMeter)
      .map((registration) => registration.metricRef as Meter)
  }

  public getTimerList(): Timer[] {
    return this.metrics
      .filter(MetricRegistry.isTimer)
      .map((registration) => registration.metricRef as Timer)
  }

  public getMetrics(): Map<string, Metric> {
    const map: Map<string, Metric> = new Map()
    this.metrics
      .forEach((registration) => map.set(registration.name, registration.metricRef))
    return map
  }

  public getMetricList(): Metric[] {
    return this.metrics.map((metric) => metric.metricRef)
  }

  public getMetricsByName(name: string): Metric[] {
    return this.getByName(name)
  }

  public getCountersByName(name: string): Counter[] {
    return this.getByName<Counter>(name)
  }

  public getMonotoneCountersByName(name: string): MonotoneCounter[] {
    return this.getByName<MonotoneCounter>(name)
  }

  public getGaugesByName(name: string): Array<Gauge<any>> {
    return this.getByName<Gauge<any>>(name)
  }

  public getHistogramsByName(name: string): Histogram[] {
    return this.getByName<Histogram>(name)
  }

  public getMetersByName(name: string): Meter[] {
    return this.getByName<Meter>(name)
  }

  public getTimersByName(name: string): Timer[] {
    return this.getByName<Timer>(name)
  }

  public removeMetrics(name: string): this {
    const metrics: Metric[] = this.getByName(name)

    metrics.forEach((metric) => {
      const index = this.metrics
        .map((m) => m.metricRef)
        .indexOf(metric, 0)
      if (index > -1) {
        this.metrics.splice(index, 1)
      }
      this.fireMetricRemoved(name, metric)
    })
    return this
  }

  public newCounter(name: string, group: string = null, description: string = null): Counter {
    const counter = new Counter(name, description)
    this.registerMetric(counter, group, description)
    return counter
  }

  public newMonotoneCounter(name: string, group: string = null, description: string = null): MonotoneCounter {
    const counter = new MonotoneCounter(name, description)
    this.registerMetric(counter, group, description)
    return counter
  }

  public newMeter(
    name: string,
    group: string = null,
    clock: Clock = this.defaultClock,
    sampleRate: number = 1,
    description: string = null): Meter {
    const meter = new Meter(clock, sampleRate, name, description)
    this.registerMetric(meter, group, description)
    return meter
  }

  public newHdrHistogram(
    name: string,
    lowest: number = 1,
    max: number = 100,
    figures: number = 3,
    group: string = null,
    description: string = null,
    buckets: Buckets = new Buckets()): HdrHistogram {
    const histogram = new HdrHistogram(lowest, max, figures, name, description, buckets)
    this.registerMetric(histogram, group, description)
    return histogram
  }

  public newHistogram(
    name: string,
    group: string = null,
    reservoir: Reservoir = null,
    description: string = null,
    buckets: Buckets = new Buckets()): Histogram {
    if (!reservoir) {
      reservoir = new SlidingWindowReservoir(1024)
    }
    const histogram = new Histogram(reservoir, name, description, buckets)
    this.registerMetric(histogram, group, description)
    return histogram
  }

  public newTimer(
    name: string,
    group: string = null,
    clock: Clock = this.defaultClock,
    reservoir: Reservoir = null,
    description: string = null,
    buckets: Buckets = new Buckets()): Timer {
    if (!reservoir) {
      reservoir = new SlidingWindowReservoir(1024)
    }
    const timer = new Timer(clock, reservoir, name, description, buckets)
    this.registerMetric(timer, group, description)
    return timer
  }

  public registerMetric(metric: Metric, group: string = null, description: string = null): this {
    if (group) {
      metric.setGroup(group)
    }

    if (description) {
      metric.setDescription(description)
    }

    if (metric instanceof Meter ||
      metric instanceof Counter ||
      metric instanceof MonotoneCounter ||
      MetricRegistry.isGauge<any>(metric) ||
      metric instanceof Histogram ||
      metric instanceof Timer) {
      this.metrics.push(new MetricRegistration(metric))
      this.fireMetricAdded(metric.getName(), metric)
    } else if (MetricRegistry.isMetricSet(metric)) {
      metric.getMetricList().forEach((m: Metric) => {
        m.setGroup(metric.getName())
        this.registerMetric(m)
      })
    }
    return this
  }

  public register(name: string, metric: Metric, group: string = null, description: string = null): this {
    if (group) {
      metric.setGroup(group)
    }

    if (description) {
      metric.setDescription(description)
    }

    metric.setName(this.generateName(name, metric))

    if (metric instanceof Meter ||
      metric instanceof Counter ||
      metric instanceof MonotoneCounter ||
      MetricRegistry.isGauge<any>(metric) ||
      metric instanceof Histogram ||
      metric instanceof Timer) {
      this.metrics.push(new MetricRegistration(metric))
      this.fireMetricAdded(name, metric)
    } else if (MetricRegistry.isMetricSet(metric)) {
      metric.getMetricList().forEach((m: Metric) => {
        const metricName = this.nameFactory(name, m.getName(), m)
        this.register(metricName, m)
      })
    }
    return this
  }

  private getByName<T extends Metric>(name: string): T[] {
    return this.metrics
      .filter((metric) => metric.name === name)
      .map((metric) => metric.metricRef) as T[]
  }

  private generateName(name: string, metric: Metric): string {
    if (metric.getGroup()) {
      return `${metric.getGroup()}.${name}`
    }
    return name
  }

  private fireMetricAdded(name: string, metric: Metric): void {
    this.listeners.forEach((listener) => listener.metricAdded(name, metric))
  }

  private fireMetricRemoved(name: string, metric: Metric): void {
    this.listeners.forEach((listener) => listener.metricRemoved(name, metric))
  }
}
