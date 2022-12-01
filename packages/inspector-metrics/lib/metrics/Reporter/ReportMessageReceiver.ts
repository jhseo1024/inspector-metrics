import "source-map-support/register"

import { Worker } from "cluster"

export interface ReportMessageReceiver {
  on(messageType: string, callback: (worker: Worker, message: any, handle: any) => any): any
}
