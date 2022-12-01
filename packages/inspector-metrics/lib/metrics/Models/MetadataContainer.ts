import "source-map-support/register"

export interface MetadataContainer {
  getMetadataMap(): Map<string, any>
  getMetadata<T>(name: string): T
  removeMetadata<T>(name: string): T
  setMetadata<T>(name: string, value: T): this
}

export interface Metadata {
  [key: string]: any
}

export function metadataToMap(metadata: Metadata): Map<string, any> {
  const metadataMap: Map<string, any> = new Map()
  if (metadata) {
    Object.keys(metadata).forEach((key) => metadataMap.set(key, metadata[key]))
  }
  return metadataMap
}

export function mapToMetadata(metadataMap: Map<string, any>): Metadata {
  const metadata: Metadata = {}
  if (metadataMap) {
    metadataMap.forEach((value, name) => metadata[name] = value)
  }
  return metadata
}
