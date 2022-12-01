import "source-map-support/register"

import { SerializedSnapshot, SimpleSnapshot, Snapshot } from "./Snapshot"

export interface Sampling {
  getSnapshot(): Snapshot
}

export interface SerializableSampling {
  snapshot: SerializedSnapshot
}

export function isSerializableSampling(metric: Sampling | SerializableSampling): metric is SerializableSampling {
  const anyMetric: any = metric as any
  if ((anyMetric.getSnapshot && typeof anyMetric.getSnapshot === "function")) {
    return false
  }
  return anyMetric.hasOwnProperty("snapshot")
}

export function getSnapshot(metric: Sampling | SerializableSampling): Snapshot {
  if (isSerializableSampling(metric)) {
    return new SimpleSnapshot(metric.snapshot.values)
  } else {
    return metric.getSnapshot()
  }
}
