import "source-map-support/register"
import { Groupable } from "./Groupable"
import { mapToMetadata, Metadata, MetadataContainer } from "./MetadataContainer"
import { mapToTags, Taggable, Tags } from "./Taggable"

export function isSerializableMetric(
  metric: Groupable | MetadataContainer | Taggable | Metric | SerializableMetric): metric is SerializableMetric {
  const anyMetric: any = metric as any
  if ((anyMetric.getGroup && typeof anyMetric.getGroup === "function") ||
    (anyMetric.getMetadataMap && typeof anyMetric.getMetadataMap === "function") ||
    (anyMetric.getTags && typeof anyMetric.getTags === "function") ||
    (anyMetric.getName && typeof anyMetric.getName === "function")) {
    return false
  }
  return typeof anyMetric.name === "string"
}

export function getMetricName(metric: Metric | SerializableMetric): string {
  if (isSerializableMetric(metric)) {
    return metric.name
  } else {
    return metric.getName()
  }
}

export function getMetricDescription(metric: Metric | SerializableMetric): string {
  if (isSerializableMetric(metric)) {
    return metric.description
  } else {
    return metric.getDescription()
  }
}

export function getMetricGroup(metric: Groupable | SerializableMetric): string {
  if (isSerializableMetric(metric)) {
    return metric.group
  } else {
    return metric.getGroup()
  }
}

export function getMetricTags(metric: Taggable | SerializableMetric): Tags {
  if (isSerializableMetric(metric)) {
    return (metric.tags as any) as Tags
  } else {
    return mapToTags(metric.getTags())
  }
}

export function getMetricMetadata(metric: MetadataContainer | SerializableMetric): Metadata {
  if (isSerializableMetric(metric)) {
    return metric.metadata
  } else {
    return mapToMetadata(metric.getMetadataMap())
  }
}

export interface Metric extends Groupable, MetadataContainer, Taggable {
  getName(): string
  setName(name: string): this
  getDescription(): string
  setDescription(description: string): this
}

export interface SerializableMetric extends Metric {
  description: string
  group: string
  metadata: Metadata
  name: string
  tags: Tags
}

export abstract class BaseMetric implements Metric, SerializableMetric {
  private static COUNTER = 0
  public readonly id: number = BaseMetric.COUNTER++
  public group: string
  public name: string
  public description: string
  protected metadataMap: Map<string, any> = new Map()
  protected tagMap: Map<string, string> = new Map()

  public get metadata(): Metadata {
    return mapToMetadata(this.metadataMap)
  }

  public get tags(): Tags {
    return mapToTags(this.tagMap)
  }

  public getMetadataMap(): Map<string, any> {
    return this.metadataMap
  }

  public getMetadata<T>(name: string): T {
    return this.metadataMap.get(name) as T
  }

  public removeMetadata<T>(name: string): T {
    const value = this.metadataMap.get(name) as T
    this.metadataMap.delete(name)
    return value
  }

  public setMetadata<T>(name: string, value: T): this {
    this.metadataMap.set(name, value)
    return this
  }

  public getName(): string {
    return this.name
  }

  public setName(name: string): this {
    this.name = name
    return this
  }

  public getDescription(): string {
    return this.description
  }

  public setDescription(description: string): this {
    this.description = description
    return this
  }

  public getGroup(): string {
    return this.group
  }

  public setGroup(group: string): this {
    this.group = group
    return this
  }

  public getTags(): Map<string, string> {
    return this.tagMap
  }

  public getTag(name: string): string {
    return this.tagMap.get(name)
  }

  public setTag(name: string, value: string): this {
    this.tagMap.set(name, value)
    return this
  }

  public setTags(tags: Map<string, string>): this {
    this.tagMap = tags
    return this
  }

  public addTags(tags: Map<string, string>): this {
    tags.forEach((value, key) => this.tagMap.set(key, value))
    return this
  }

  public removeTag(name: string): this {
    this.tagMap.delete(name)
    return this
  }

  public removeTags(...names: string[]): this {
    names.forEach((name) => this.removeTag(name))
    return this
  }

  public toString(): string {
    if (this.group) {
      return `${this.group}.${this.name}`
    }
    return this.name
  }

  public toJSON(): any {
    return {
      description: this.getDescription(),
      group: this.getGroup(),
      metadata: this.metadata,
      name: this.getName(),
      tags: this.tags,
    }
  }
}
