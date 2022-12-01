import "source-map-support/register"
import { Int64Wrapper } from "./int64"

export interface Summarizing {
  getSum(): Int64Wrapper
}

export interface SerializableSummarizing {
  sum: string
}
