const Int64 = require("node-cint64").Int64

export class Int64Wrapper {
  private num: any

  public constructor(initial: number = 0) {
    this.num = new Int64(initial)
  }

  public add(value: number): this {
    this.num = this.num.add(value)
    return this
  }

  public toNumber(): number {
    return this.num.toNumber()
  }

  public toString(): string {
    return this.num.toString()
  }
}
