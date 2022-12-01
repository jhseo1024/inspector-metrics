import "source-map-support/register"

import * as cluster from "cluster"
import { Worker } from "cluster"
import { Clock } from "../Clock"
import { ReportMessageReceiver } from "./ReportMessageReceiver"

const defaultCluster = (cluster.default || cluster) as any

export interface ClusterOptions<Worker> {
  readonly enabled: boolean
  readonly sendMetricsToMaster: boolean
  readonly eventReceiver: ReportMessageReceiver

  sendToMaster(message: any): Promise<any>
  sendToWorker(worker: Worker, message: any): Promise<any>
  getWorkers(): Promise<Worker[]>
}

export interface MetricReporterOptions {
  readonly clock?: Clock
  minReportingTimeout?: number
  clusterOptions?: ClusterOptions<any>
  tags?: Map<string, string>
}

export class DefaultClusterOptions implements ClusterOptions<Worker> {
  public readonly enabled: boolean = true
  public readonly eventReceiver: ReportMessageReceiver = defaultCluster
  public readonly getWorkers: () => Promise<Worker[]> = null
  public readonly sendMetricsToMaster: boolean = !!defaultCluster.worker
  public readonly sendToWorker: (worker: Worker, message: any) => Promise<any> = null
  public readonly sendToMaster: (message: any) => Promise<any> = async (message: any) => defaultCluster.worker.send(message)
}

export class DisabledClusterOptions implements ClusterOptions<Worker> {
  public readonly enabled: boolean = false
  public readonly eventReceiver: ReportMessageReceiver = null
  public readonly getWorkers: () => Promise<Worker[]> = null
  public readonly sendMetricsToMaster: boolean = false
  public readonly sendToWorker: (worker: Worker, message: any) => Promise<any> = null
  public readonly sendToMaster: (message: any) => Promise<any> = null
}
