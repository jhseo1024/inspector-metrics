import 'source-map-support/register'

import { Gauge } from './Gauge'
import { BaseMetric } from './Models/Metric'

export class Event<TEventData> extends BaseMetric implements Gauge<TEventData> {
  private value: TEventData
  private time: Date

  public constructor(name: string, description?: string, group?: string, time: Date = new Date()) {
    super()
    this.time = time
    this.name = name
    this.description = description
    this.group = group
  }

  public getTime(): Date {
    return this.time
  }

  public setTime(time: Date): this {
    this.time = time
    return this
  }

  public getValue(): TEventData {
    return this.value
  }

  public setValue(value: TEventData): this {
    this.value = value
    return this
  }

  public toString(): string {
    return this.name
  }

  public toJSON(): any {
    const json = super.toJSON()
    json.value = this.value
    json.time = this.time
    return json
  }
}
