import 'source-map-support/register'

import { BaseMetric, Metric, SerializableMetric } from './Models/metric'

export interface Gauge<T> extends Metric, SerializableMetric {
  getValue(): T
}

export class SimpleGauge extends BaseMetric implements Gauge<number> {
  private value: number = 0

  public constructor(name?: string, description?: string) {
    super()
    this.name = name
    this.description = description
  }

  public getValue(): number {
    return this.value
  }

  public setValue(value: number): this {
    this.value = value
    return this
  }

  public toJSON(): any {
    const json = super.toJSON()
    json.value = this.value
    return json
  }
}
