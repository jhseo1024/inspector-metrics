import 'source-map-support'

export class Percentiles {
  public static readonly METADATA_NAME = 'quantiles';

  constructor(public boundaries: number[] = [0.01, 0.05, 0.5, 0.75, 0.9, 0.95, 0.98, 0.99, 0.999]) {
    boundaries.sort((a: number, b: number) => a - b)
    boundaries.forEach((boundary) => {
      if (boundary <= 0.0) {
        throw new Error('boundaries cannot be smaller or equal to 0.0')
      }

      if (boundary >= 1.0) {
        throw new Error('boundaries cannot be greater or equal to 1.0')
      }
    })
  }
}
