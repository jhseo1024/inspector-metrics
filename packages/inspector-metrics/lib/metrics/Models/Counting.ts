import "source-map-support/register"
import { Metric, SerializableMetric } from "./Metric"

export interface Counting extends Metric {
  getCount(): number
}

export class Buckets {
  public static linear(start: number, bucketWidth: number, count: number, precision = 10000): Buckets {
    const boundaries = new Array(count)
    const buckets = new Buckets(boundaries)
    for (let i = 0; i < count; i++) {
      buckets.boundaries[i] = start
      buckets.boundaries[i] *= precision
      buckets.boundaries[i] = Math.floor(buckets.boundaries[i])
      buckets.boundaries[i] /= precision
      start += bucketWidth
    }
    return buckets
  }

  public static exponential(initial: number, factor: number, count: number, precision = 10000): Buckets {
    if (initial <= 0.0) {
      throw new Error("initial values needs to be greater than 0.0")
    }
    if (count < 1.0) {
      throw new Error("count needs to be at least 1")
    }
    if (factor <= 1.0) {
      throw new Error("factor needs to be greater than 1.0")
    }

    const boundaries = new Array(count)
    const buckets = new Buckets(boundaries)
    buckets.boundaries[0] = initial
    for (let i = 1; i < count; i++) {
      buckets.boundaries[i] = buckets.boundaries[i - 1] * factor
      buckets.boundaries[i] *= precision
      buckets.boundaries[i] = Math.floor(buckets.boundaries[i])
      buckets.boundaries[i] /= precision
    }
    return buckets
  }

  constructor(
    public readonly boundaries: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  ) {
    boundaries.sort((a: number, b: number) => a - b)
  }
}

export interface BucketCounting extends Metric {
  getBuckets(): Buckets
  getCounts(): Map<number, number>
}

export interface BucketToCountMap {
  [bucket: number]: number
}

export interface SerializableBucketCounting extends SerializableMetric {
  buckets: number[]
  counts: BucketToCountMap
}

export function isSerializableBucketCounting(
  metric: BucketCounting | SerializableBucketCounting): metric is SerializableBucketCounting {
  const anyMetric: any = metric as any
  if ((anyMetric.getBuckets && typeof anyMetric.getBuckets === "function") ||
    (anyMetric.getCounts && typeof anyMetric.getCounts === "function")) {
    return false
  }
  return Array.isArray(anyMetric.buckets)
}

export function getMetricBuckets(metric: BucketCounting | SerializableBucketCounting): Buckets {
  if (isSerializableBucketCounting(metric)) {
    return new Buckets(metric.buckets)
  } else {
    return metric.getBuckets()
  }
}

export function getMetricCounts(metric: BucketCounting | SerializableBucketCounting): BucketToCountMap {
  if (isSerializableBucketCounting(metric)) {
    return metric.counts
  } else {
    const counts: BucketToCountMap = {}
    for (const [bucket, count] of metric.getCounts()) {
      counts[bucket] = count
    }
    return counts
  }
}
