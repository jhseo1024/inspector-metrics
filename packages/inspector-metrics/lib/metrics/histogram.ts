import 'source-map-support/register'

import { BucketCounting, Buckets, BucketToCountMap, Counting, SerializableBucketCounting } from './Models/counting'
import { Int64Wrapper } from './Models/int64'
import { BaseMetric, Metric } from './Models/metric'
import { Reservoir } from './Models/reservoir'
import { Sampling, SerializableSampling } from './Models/sampling'
import { SerializedSnapshot, Snapshot } from './Models/snapshot'
import { SerializableSummarizing, Summarizing } from './Models/summarizing'

export class Histogram extends BaseMetric implements
  BucketCounting, Counting, Metric, Sampling, Summarizing,
  SerializableSummarizing, SerializableBucketCounting,
  SerializableSampling {
  protected readonly reservoir: Reservoir
  protected count: number = 0
  protected sumInternal: Int64Wrapper = new Int64Wrapper()
  protected readonly bucketCounts: Map<number, number> = new Map()
  protected readonly bucketsInternal: Buckets

  public constructor(reservoir: Reservoir, name?: string, description?: string, buckets: Buckets = new Buckets()) {
    super()

    this.reservoir = reservoir
    this.name = name
    this.description = description
    this.bucketsInternal = buckets
    for (const boundary of this.bucketsInternal.boundaries) {
      this.bucketCounts.set(boundary, 0)
    }
  }

  public get buckets(): number[] {
    return this.bucketsInternal.boundaries
  }

  public get counts(): BucketToCountMap {
    const counts: BucketToCountMap = {}
    for (const [bucket, count] of this.bucketCounts) {
      counts[bucket] = count
    }
    return counts
  }

  public get sum(): string {
    return this.sumInternal.toString()
  }

  public get snapshot(): SerializedSnapshot {
    return {
      values: this.reservoir.snapshot().getValues()
    }
  }

  public update(value: number): this {
    this.count++
    this.sumInternal.add(value)
    for (const boundary of this.bucketsInternal.boundaries) {
      if (value < boundary) {
        this.bucketCounts.set(boundary, this.bucketCounts.get(boundary) + 1)
      }
    }
    this.reservoir.update(value)
    return this
  }

  public getSnapshot(): Snapshot {
    return this.reservoir.snapshot()
  }

  public getCount(): number {
    return this.count
  }

  public getSum(): Int64Wrapper {
    return this.sumInternal
  }

  public getBuckets(): Buckets {
    return this.bucketsInternal
  }

  public getCounts(): Map<number, number> {
    return this.bucketCounts
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
    json.snapshot = this.snapshot
    return json
  }
}
