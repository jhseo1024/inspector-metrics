import "source-map-support/register"

export interface Tags {
  [key: string]: string
}

export interface Taggable {
  getTags(): Map<string, string>
  getTag(name: string): string
  setTag(name: string, value: string): this
  setTags(tags: Map<string, string>): this
  addTags(tags: Map<string, string>): this
  removeTag(name: string): this
  removeTags(...names: string[]): this
}

export function tagsToMap(tags: Tags): Map<string, string> {
  const tagMap: Map<string, string> = new Map()
  if (tags) {
    Object.keys(tags).forEach((key) => tagMap.set(key, tags[key]))
  }
  return tagMap
}

export function mapToTags(tagMap: Map<string, string>): Tags {
  const tags: Tags = {}
  if (tagMap) {
    tagMap.forEach((tag, name) => tags[name] = tag)
  }
  return tags
}
