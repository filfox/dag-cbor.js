import * as assert from 'assert';
import * as base32 from 'base32.js';
import BufferReader from './buffer-reader';
import BufferWriter from './buffer-writer';

export default class Cid {
  constructor(public readonly data: Buffer) {}

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

  toBuffer() {
    const writer = new BufferWriter();
    this.toBufferWriter(writer);
    return writer.toBuffer();
  }

  toBufferWriter(writer: BufferWriter) {
    writer.writeHeader(6, 42);
    writer.writeBytes(Buffer.concat([Buffer.from([0]), this.data]));
  }

  toString() {
    return `b${new base32.Encoder({ type: 'rfc4648', lc: true }).write(this.data).finalize()}`;
  }
}
