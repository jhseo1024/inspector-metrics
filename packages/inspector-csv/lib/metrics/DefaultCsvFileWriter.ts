import 'source-map-support'

import * as async from 'async'
import { appendFile, mkdir, stat, Stats } from 'fs'
import { join } from 'path'

import { Metric, SerializableMetric } from 'inspector-metrics'
import { CsvFileWriter } from './CsvMetricReporter'
import moment = require('moment')

export interface DefaultCsvFileWriterOptions {
  readonly writeHeaders?: boolean
  readonly createDir?: boolean
  readonly delimiter?: string
  readonly encoding?: string
  readonly lineEnding?: string
  readonly filename?: () => Promise<string>
  readonly dir?: () => Promise<string>
}

export class DefaultCsvFileWriter implements CsvFileWriter {
  private readonly options: DefaultCsvFileWriterOptions
  private currentFilename: string
  private currentDir: string
  private readonly queue: async.AsyncQueue<any>

  public constructor({
    filename = async () => `${moment().format('YYYYMMDDHH00')}_metrics.csv`,
    dir = async () => './metrics',
    writeHeaders = true,
    createDir = true,
    delimiter = ',',
    encoding = 'utf8',
    lineEnding = '\n'
  }: DefaultCsvFileWriterOptions) {
    this.options = {
      createDir,
      delimiter,
      dir,
      encoding,
      filename,
      lineEnding,
      writeHeaders
    }
    this.queue = async.queue((task: (clb: () => void) => void, callback: () => void) => {
      task(callback)
    }, 1)
  }

  public async init(header: string[]): Promise<void> {
    const dir = await this.options.dir()
    const filename = await this.options.filename()

    if (filename !== this.currentFilename || dir !== this.currentDir) {
      let createDir = false
      if (this.options.createDir) {
        try {
          const stats = await this.stat(dir)
          createDir = !stats.isDirectory()
        } catch (err) {
          createDir = true
        }
      }
      if (createDir) {
        await this.mkdir(dir)
      }

      let writeHeader = false
      const normalizedFilename = join(dir, filename)
      if (this.options.writeHeaders) {
        try {
          const stats = await this.stat(normalizedFilename)
          writeHeader = stats.size === 0
        } catch (err) {
          writeHeader = true
        }
      }
      if (writeHeader) {
        await this.write(
          normalizedFilename,
          header.join(this.options.delimiter) + this.options.lineEnding
        )
      }
    }
    this.currentDir = dir
    this.currentFilename = filename
  }

  public async writeRow(metric: Metric | SerializableMetric, values: string[]): Promise<void> {
    const normalizedFilename = join(this.currentDir, this.currentFilename)
    this.queue.push(async (callback: () => void) => {
      await this.write(
        normalizedFilename,
        values.join(this.options.delimiter) + this.options.lineEnding
      )
      callback()
    })
  }

  private async write(filename: string, data: string): Promise<void> {
    return await new Promise<void>((resolve, reject) => {
      appendFile(
        filename,
        data,
        this.options.encoding as any,
        (err) => {
          if (err) {
            reject(err)
            return
          }
          resolve()
        }
      )
    })
  }

  private async mkdir(dir: string): Promise<void> {
    return await new Promise<void>((resolve, reject) => {
      mkdir(dir, (err) => {
        if (err) {
          reject(err)
          return
        }
        resolve()
      })
    })
  }

  private async stat(filename: string): Promise<Stats> {
    return await new Promise<Stats>((resolve, reject) => {
      stat(filename, (err, stats) => {
        if (err) {
          reject(err)
          return
        }
        resolve(stats)
      })
    })
  }
}
