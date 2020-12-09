import * as assert from 'assert';
import { Buffer } from 'buffer';
import { createHash } from 'crypto-browserify';
import Address from './address';
import BufferReader from './buffer-reader';
import Cid from './cid';
import { DecodedParamType, ParamType } from './parameter';

function sha256(buffer: Buffer): Buffer {
  return createHash('sha256').update(buffer).digest();
}

function bitCount(n: number) {
  n -= n >>> 1 & 0x55555555;
  n = (n & 0x33333333) + (n >>> 2 & 0x33333333);
  return (n + (n >>> 4) & 0x0f0f0f0f) * 0x01010101 >>> 24;
}

type ChainReadObj = (cid: Cid) => Buffer | PromiseLike<Buffer>;
export type HAMTKey = 'address' | 'cid' | 'number';

export class HAMTType<K extends HAMTKey, V extends ParamType> {
  constructor(public readonly KeyType: K, public readonly ValueType: V) {}

  public keyEquals(x: DecodedParamType<K>, y: DecodedParamType<K>) {
    if (this.KeyType === 'address') {
      return (x as Address).protocol === (y as Address).protocol && (x as Address).data.equals((y as Address).data);
    } else if (this.KeyType === 'cid') {
      return (x as Cid).data.equals((y as Cid).data);
    } else {
      return x === y;
    }
  }
}

class HAMTPointer<K extends HAMTKey, V extends ParamType> {
  private constructor(
    public readonly Link: Cid | null,
    public readonly KVs: { key: DecodedParamType<K>; value: DecodedParamType<V> }[] | null,
  ) {}

  static fromBufferReader<K extends HAMTKey, V extends ParamType>(reader: BufferReader, type: HAMTType<K, V>): HAMTPointer<K, V> {
    assert.deepStrictEqual(reader.readHeader(), { majority: 5, extra: 1 });
    assert.deepStrictEqual(reader.readHeader(), { majority: 3, extra: 1 });
    const flag = reader.read(1).toString();
    assert.ok(flag === '0' || flag === '1');
    if (flag === '0') {
      return new HAMTPointer(reader.readCid(), null);
    } else {
      const length = reader.readArrayLength();
      const pairs: { key: DecodedParamType<K>; value: DecodedParamType<V> }[] = [];
      for (let i = 0; i < length; ++i) {
        assert.deepStrictEqual(reader.readHeader(), { majority: 4, extra: 2 });
        let key: DecodedParamType<HAMTKey>;
        if (type.KeyType === 'address') {
          key = reader.readAddress();
        } else if (type.KeyType === 'cid') {
          key = reader.readCid();
        } else {
          const keyBytes = reader.readBytes();
          key = Number.parseInt(keyBytes.toString('hex'), 16);
        }
        const value = reader.readType(type.ValueType);
        pairs.push({ key: key as DecodedParamType<K>, value });
      }
      return new HAMTPointer(null, pairs);
    }
  }
}

export default class HAMT<K extends HAMTKey, V extends ParamType> {
  private constructor(
    public readonly Bitfield: number,
    public readonly Pointers: HAMTPointer<K, V>[],
    private readonly type: HAMTType<K, V>
  ) {}

  static fromBuffer<K extends HAMTKey, V extends ParamType>(buffer: Buffer, type: HAMTType<K, V>) {
    return HAMT.fromBufferReader(new BufferReader(buffer), type);
  }

  static fromBufferReader<K extends HAMTKey, V extends ParamType>(reader: BufferReader, type: HAMTType<K, V>) {
    assert.deepStrictEqual(reader.readHeader(), { majority: 4, extra: 2 });
    const bitfieldBytes = reader.readBytes();
    const bitfield = bitfieldBytes.length === 0 ? 0 : Number.parseInt(bitfieldBytes.toString('hex'), 16);
    const pointerLength = reader.readArrayLength();
    const pointers: HAMTPointer<K, V>[] = [];
    for (let i = 0; i < pointerLength; ++i) {
      pointers.push(HAMTPointer.fromBufferReader(reader, type));
    }
    return new HAMT<K, V>(bitfield, pointers, type);
  }

  async get(key: DecodedParamType<K>, chainReadObj: ChainReadObj) {
    // eslint-disable-next-line consistent-this, @typescript-eslint/no-this-alias
    let node: HAMT<K, V> = this;
    let keyBuffer: Buffer;
    if (this.type.KeyType === 'address') {
      const address = key as Address;
      keyBuffer = Buffer.from([address.protocol, ...address.data]);
    } else if (this.type.KeyType === 'cid') {
      const cid = key as Cid;
      keyBuffer = Buffer.from([0, ...cid.data]);
    } else {
      let string = (key as number).toString(16);
      if (string.length % 2) {
        string = `0${string}`;
      }
      keyBuffer = Buffer.from(string, 'hex');
    }
    const hash = sha256(keyBuffer);
    for (let chunk = 0; chunk < 256 / 5; ++chunk) {
      const bufferIndex = chunk * 5 >>> 3;
      const bufferOffset = chunk * 5 & 7;
      const index = bufferOffset <= 3
        ? hash[bufferIndex] >>> 3 - bufferOffset & 0x1f
        : hash[bufferIndex] << bufferOffset - 3 & 0x1f | hash[bufferIndex + 1] >>> 11 - bufferOffset;
      if ((node.Bitfield & 1 << index) === 0) {
        return;
      }
      const pointerIndex = index === 0 ? 0 : bitCount(node.Bitfield & (1 << index) - 1);
      const pointer = node.Pointers[pointerIndex];
      if (pointer.Link) {
        const buffer = await chainReadObj(pointer.Link);
        node = HAMT.fromBuffer(buffer, this.type);
      } else {
        return pointer.KVs!.find(p => this.type.keyEquals(p.key, key))?.value;
      }
    }
  }

  async* keys(chainReadObj: ChainReadObj) {
    for await (const [key, _] of this.entries(chainReadObj)) {
      yield key;
    }
  }

  async* values(chainReadObj: ChainReadObj) {
    for await (const [_, value] of this.entries(chainReadObj)) {
      yield value;
    }
  }

  async* entries(chainReadObj: ChainReadObj): AsyncGenerator<[DecodedParamType<K>, DecodedParamType<V>]> {
    for (const pointer of this.Pointers) {
      if (pointer.Link) {
        const buffer = await chainReadObj(pointer.Link);
        const node = HAMT.fromBuffer(buffer, this.type);
        yield* node.entries(chainReadObj);
      } else {
        for (const { key, value } of pointer.KVs!) {
          yield [key, value];
        }
      }
    }
  }

  async getMap(chainReadObj: ChainReadObj) {
    const list: [string, DecodedParamType<V>][] = [];
    for await (const [key, value] of this.entries(chainReadObj)) {
      list.push([key.toString(), value]);
    }
    return new Map(list);
  }
}
