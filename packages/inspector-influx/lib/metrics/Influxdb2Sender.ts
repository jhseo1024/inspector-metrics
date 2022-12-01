import 'source-map-support/register'

import { ClientOptions, InfluxDB, Point, WriteApi, WriteOptions, WritePrecisionType } from '@influxdata/influxdb-client'
import { BucketsAPI, OrgsAPI, RetentionRules } from '@influxdata/influxdb-client-apis'
import { MeasurementPoint, Sender } from './InfluxMetricReporter'

export class Influxdb2Sender implements Sender {
  private readonly db: InfluxDB
  private readonly writeApi: WriteApi
  private readonly retentionRules: RetentionRules
  private readonly bucket: string
  private readonly org: string
  private ready: boolean = false

  public constructor(
    config: ClientOptions | string,
    org: string,
    bucket: string,
    retentionRules: RetentionRules = [],
    precision: WritePrecisionType = 's',
    writeOptions?: Partial<WriteOptions>) {
    this.org = org
    this.bucket = bucket
    this.retentionRules = retentionRules
    this.db = new InfluxDB(config)
    this.writeApi = this.db.getWriteApi(this.org, this.bucket, precision, writeOptions)
  }

  public async init(): Promise<any> {
    const orgsAPI = new OrgsAPI(this.db)
    const {
      orgs: [org],
    } = await orgsAPI.getOrgs({
      org: this.org,
    })

    const bucketsAPI = new BucketsAPI(this.db)
    const {
      buckets: [bucket],
    } = await bucketsAPI.getBuckets({
      orgID: org.id,
      name: this.bucket,
    })

    if (!bucket) {
      await bucketsAPI.postBuckets({
        body: {
          retentionRules: this.retentionRules,
          orgID: org.id,
          name: this.bucket,
        },
      })
    }
    this.ready = true
  }

  public async isReady(): Promise<boolean> {
    return this.ready
  }

  public async send(points: MeasurementPoint[]): Promise<void> {
    await this.writeApi.writePoints(points.map(point => {
      const newPoint = new Point(point.measurement)
        .timestamp(point.timestamp)

      for (const fieldName in point.fields) {
        newPoint.fields[fieldName] = `${point.fields[fieldName]}`
      }

      for (const tag in point.tags) {
        newPoint.tag(tag, point.tags[tag])
      }

      return newPoint
    }))
    await this.writeApi.flush()
  }
}
