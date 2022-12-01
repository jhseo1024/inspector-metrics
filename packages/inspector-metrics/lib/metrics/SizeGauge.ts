import 'source-map-support/register'

import { Gauge } from './Gauge'
import { BaseMetric } from './Models/Metric'

export interface LengthMethodInterface {
  length(): number
}

export interface LengthAttributeInterface {
  length: number
}

export interface SizeMethodInterface {
  size(): number
}

export interface SizeAttributeInterface {
  size: number
}

type ValueExtractor = () => number

export class SizeGauge extends BaseMetric implements Gauge<number> {
  protected static isLengthAttributeInterface(collection: any): collection is LengthAttributeInterface {
    return collection && typeof collection.length === 'number'
  }

  protected static isLengthMethodInterface(collection: any): collection is LengthMethodInterface {
    return collection && typeof collection.length === 'function'
  }

  protected static isSizeAttributeInterface(collection: any): collection is SizeAttributeInterface {
    return collection && typeof collection.size === 'number'
  }

  protected static isSizeMethodInterface(collection: any): collection is SizeMethodInterface {
    return collection && typeof collection.size === 'function'
  }

  private readonly extractor: ValueExtractor

  public constructor(
    name: string,
    collection: LengthAttributeInterface | LengthMethodInterface | SizeAttributeInterface | SizeMethodInterface,
    description?: string) {
    super()

    this.setName(name)
    this.setDescription(description)

    if (SizeGauge.isLengthAttributeInterface(collection)) {
      this.extractor = () => collection.length
    } else if (SizeGauge.isLengthMethodInterface(collection)) {
      this.extractor = () => collection.length()
    } else if (SizeGauge.isSizeAttributeInterface(collection)) {
      this.extractor = () => collection.size
    } else if (SizeGauge.isSizeMethodInterface(collection)) {
      this.extractor = () => collection.size()
    } else {
      this.extractor = () => -1
    }
  }

  public getValue(): number {
    return this.extractor()
  }

  public toJSON(): any {
    const json = super.toJSON()
    json.value = this.extractor()
    return json
  }
}
