import "source-map-support/register"

import { Metric, SerializableMetric } from "./Metric"

export interface Metered extends Metric {
  getCount(): number
  get15MinuteRate(): number
  get5MinuteRate(): number
  get1MinuteRate(): number
  getMeanRate(): number
}

export interface MeteredRates {
  [rate: number]: number
}

export interface SerializableMetered extends SerializableMetric {
  count: number
  meanRate: number
  rates: MeteredRates
}
