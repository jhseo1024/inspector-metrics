import 'source-map-support/register'

import { IClusterConfig, InfluxDB, IPoint, TimePrecision } from 'influx'
import { Sender } from './InfluxMetricReporter'

export class Influxdb1Sender implements Sender {
  private readonly db: InfluxDB
  private readonly config: IClusterConfig
  private ready: boolean = false
  private readonly precision: TimePrecision

  public constructor(config: IClusterConfig, precision: TimePrecision = 's') {
    this.config = config
    this.precision = precision
    this.db = new InfluxDB(config)
  }

  public async init(): Promise<any> {
    const database = this.config.database
    const databases = await this.db.getDatabaseNames()
    if ((databases instanceof String && databases.localeCompare(database) !== 0) ||
      (databases instanceof Array &&
        !databases.find((value: string, index: number, arr: string[]) =>
          value.localeCompare(database) === 0))) {
      await this.db.createDatabase(database)
    }
    this.ready = true
  }

  public async isReady(): Promise<boolean> {
    return this.ready
  }

  public async send(points: IPoint[]): Promise<void> {
    await this.db.writePoints(points, { precision: this.precision })
  }
}
