import 'source-map-support/register'

import { Counting } from './Models/Counting'
import { BaseMetric, Metric } from './Models/Metric'

export class MonotoneCounter extends BaseMetric implements Counting, Metric {
  protected count: number = 0

  public constructor(name?: string, description?: string) {
    super()
    this.name = name
    this.description = description
  }

  public increment(value: number): this {
    if (value < 0) {
      throw new Error('MonotoneCounter must not be increased by a negative value')
    }
    this.count += value
    return this
  }

  public getCount(): number {
    return this.count
  }

  public reset(): this {
    this.count = 0
    return this
  }

  public toJSON(): any {
    const json = super.toJSON()
    json.count = this.count
    return json
  }
}

export class Counter extends MonotoneCounter implements Counting, Metric {
  public constructor(name?: string, description?: string) {
    super(name, description)
  }

  public increment(value: number): this {
    this.count += value
    return this
  }

  public decrement(value: number): this {
    this.count -= value
    return this
  }
}
