import 'source-map-support/register'

import { Histogram } from './Histogram'
import { BucketCounting, Buckets, Counting } from './Models/Counting'
import { Metric } from './Models/Metric'
import { Sampling } from './Models/Sampling'
import { SerializedSnapshot, Snapshot } from './Models/Snapshot'
import { Summarizing } from './Models/Summarizing'

let NativeHistogram: any = null
try {
  NativeHistogram = require('native-hdr-histogram')
} catch (e) {
}

export class HdrSnapshot implements Snapshot, SerializedSnapshot {
  public constructor(private readonly reference: any) {
  }

  public get75thPercentile(): number {
    return this.reference.histogram.percentile(75)
  }

  public get95thPercentile(): number {
    return this.reference.histogram.percentile(95)
  }

  public get98thPercentile(): number {
    return this.reference.histogram.percentile(98)
  }

  public get999thPercentile(): number {
    return this.reference.histogram.percentile(99.9)
  }

  public get99thPercentile(): number {
    return this.reference.histogram.percentile(99)
  }

  public getMedian(): number {
    return this.reference.histogram.percentile(50)
  }

  public getMax(): number {
    return this.reference.histogram.max() || 0
  }

  public getMin(): number {
    return this.reference.histogram.min() || 0
  }

  public get values(): number[] {
    return []
  }

  public getValues(): number[] {
    return []
  }

  public size(): number {
    return this.reference.getCount()
  }

  public getMean(): number {
    return this.reference.histogram.mean() || 0
  }

  public getStdDev(): number {
    return this.reference.histogram.stddev() || 0
  }

  public getValue(quantile: number): number {
    return this.reference.histogram.percentile(quantile * 100.0)
  }
}

export class HdrHistogram extends Histogram implements BucketCounting, Counting, Metric, Sampling, Summarizing {
  private readonly histogram: any
  private readonly hdrSnapshot: HdrSnapshot

  public constructor(
    lowest: number = 1,
    max: number = 100,
    figures: number = 3,
    name?: string,
    description?: string,
    buckets: Buckets = new Buckets()) {
    super(null, name, description, buckets)

    if (!NativeHistogram) {
      throw new Error("Module 'native-hdr-histogram' not found. " +
        "Please install the optional dependencies of 'inspector-metrics' module.")
    }

    this.histogram = new NativeHistogram(lowest, max, figures)
    this.hdrSnapshot = new HdrSnapshot(this)
  }

  public get snapshot(): SerializedSnapshot {
    return this.hdrSnapshot
  }

  public getSnapshot(): Snapshot {
    return this.hdrSnapshot
  }

  public update(value: number): this {
    this.count++
    this.sumInternal.add(value)
    for (const boundary of this.bucketsInternal.boundaries) {
      if (value < boundary) {
        this.bucketCounts.set(boundary, this.bucketCounts.get(boundary) + 1)
      }
    }
    this.histogram.record(value)
    return this
  }

  public toJSON(): any {
    const json = super.toJSON()
    json.counts = {}
    for (const [key, value] of this.bucketCounts) {
      json.counts[key] = value
    }
    json.buckets = this.bucketsInternal.boundaries
    json.count = this.count
    json.sum = this.sumInternal.toString()
    json.snapshot = {
      values: this.snapshot.values
    }
    return json
  }
}
