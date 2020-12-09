import * as assert from 'assert';
import * as base32 from 'base32.js';
import { Buffer } from 'buffer';
import BufferReader from './buffer-reader';

export default class Cid {
  constructor(private readonly _data: Buffer) {}

  static fromBuffer(buffer: Buffer) {
    return Cid.fromBufferReader(new BufferReader(buffer));
  }

  static fromBufferReader(reader: BufferReader) {
    assert.deepStrictEqual(reader.readHeader(), { majority: 6, extra: 42 });
    const buffer = reader.readBytes();
    assert.strictEqual(buffer[0], 0);
    return new Cid(buffer.slice(1));
  }

  static fromString(string: string) {
    const buffer: Buffer = new base32.Decoder().write(string.slice(1)).finalize();
    return new Cid(buffer);
  }

  get data() {
    return this._data;
  }

  toString() {
    return `b${new base32.Encoder({ type: 'rfc4648', lc: true }).write(this._data).finalize()}`;
  }
}
