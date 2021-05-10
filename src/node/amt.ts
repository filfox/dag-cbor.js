import * as assert from 'assert';
import BufferReader from './buffer-reader';
import Cid from './cid';
import { DecodedParamType, ParamType } from './parameter';

function bitCount(n: number) {
  n -= n >>> 1 & 0x55555555;
  n = (n & 0x33333333) + (n >>> 2 & 0x33333333);
  return (n + (n >>> 4) & 0x0f0f0f0f) * 0x01010101 >>> 24;
}

type ChainReadObj = (cid: Cid) => Buffer | Promise<Buffer>;
export type AMTVersion = 2 | 3;

export class AMTType<T extends ParamType> {
  constructor(public readonly Type: T, public readonly version: AMTVersion) {}
}

class AMTNode<T extends ParamType> {
  private constructor(
    public readonly Bmap: Buffer,
    public readonly Links: Cid[],
    public readonly Values: DecodedParamType<T>[]
  ) {}

  static fromBufferReader<T extends ParamType>(reader: BufferReader, type: AMTType<T>) {
    assert.deepStrictEqual(reader.readHeader(), { majority: 4, extra: 3 });
    const bmap = reader.readBytes();
    assert.strictEqual(bmap.length, 1);
    const links = reader.readType(['cid']);
    const values = reader.readType([type.Type]);
    return new AMTNode<T>(bmap, links, values);
  }
}

export default class AMT<T extends ParamType> {
  private constructor(
    public readonly BitWidth: number,
    public readonly Height: number,
    public readonly Count: number,
    public readonly Node: AMTNode<T>,
    private type: AMTType<T>
  ) {}

  static fromBuffer<T extends ParamType>(buffer: Buffer, type: AMTType<T>) {
    return AMT.fromBufferReader(new BufferReader(buffer), type);
  }

  static fromBufferReader<T extends ParamType>(reader: BufferReader, type: AMTType<T>) {
    if (type.version === 2) {
      assert.deepStrictEqual(reader.readHeader(), { majority: 4, extra: 3 });
      const height = reader.readNumber();
      const count = reader.readNumber();
      const node = AMTNode.fromBufferReader(reader, type);
      return new AMT<T>(3, height, count, node, type);
    } else {
      assert.deepStrictEqual(reader.readHeader(), { majority: 4, extra: 4 });
      const bitWidth = reader.readNumber();
      const height = reader.readNumber();
      const count = reader.readNumber();
      const node = AMTNode.fromBufferReader(reader, type);
      return new AMT<T>(bitWidth, height, count, node, type);
    }
  }

  async get(index: number, chainReadObj: ChainReadObj) {
    const width = 2 ** this.BitWidth;
    if (index >= width ** (this.Height + 1)) {
      return;
    }
    let node = this.Node;
    for (let height = this.Height; height >= 0; --height) {
      const subIndex = Math.floor(index / width ** height) % width;
      if ((node.Bmap[0] & 1 << subIndex) === 0) {
        return;
      }
      const offset = bitCount(node.Bmap[0] & (1 << subIndex) - 1);
      if (height === 0) {
        return node.Values[offset];
      }
      const buffer = await chainReadObj(node.Links[offset]);
      node = AMTNode.fromBufferReader(new BufferReader(buffer), this.type);
    }
  }

  * keys() {
    for (let i = 0; i < this.Count; ++i) {
      yield i;
    }
  }

  async* values(chainReadObj: ChainReadObj): AsyncGenerator<DecodedParamType<T> | undefined> {
    throw 'TODO';
  }

  async* entries(chainReadObj: ChainReadObj) {
    let index = 0;
    for await (const value of this.values(chainReadObj)) {
      yield [index++, value];
    }
  }

  async getArray(chainReadObj: ChainReadObj) {
    const list: (DecodedParamType<T> | undefined)[] = [];
    for await (const value of this.values(chainReadObj)) {
      list.push(value);
    }
    return list;
  }
}
