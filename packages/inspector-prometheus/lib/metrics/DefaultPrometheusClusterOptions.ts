import 'source-map-support'

import * as cluster from 'cluster'
import { Worker } from 'cluster'

import { ReportMessageReceiver } from 'inspector-metrics'
import { PrometheusClusterOptions } from './PrometheusClusterOptions'

const defaultCluster = (cluster.default || cluster) as any

export class DefaultPrometheusClusterOptions implements PrometheusClusterOptions<Worker> {
  public readonly workerResponseTimeout: number = 500
  public readonly enabled: boolean = true
  public readonly eventReceiver: ReportMessageReceiver
  public readonly sendMetricsToMaster: boolean = defaultCluster.isWorker

  public constructor() {
    if (defaultCluster.isWorker) {
      this.eventReceiver = {
        on: (
          messageType: any,
          callback: (worker: Worker, message: any, handle: any) => void) => {
          process.on(messageType, (message) => callback(null, message, null))
        }
      }
    } else {
      this.eventReceiver = defaultCluster
    }
  }

  public async sendToWorker(worker: Worker, message: any): Promise<any> {
    if (worker) {
      worker.send(message)
    }
  }

  public async getWorkers(): Promise<Worker[]> {
    const workers: Worker[] = []
    if (workers) {
      for (const key of Object.keys(workers)) {
        workers.push(workers[key as any])
      }
    }
    return workers
  }

  public async sendToMaster(message: any): Promise<any> {
    process.send(message)
  }
}
