import { Buffer } from 'buffer';
import BufferReader from './buffer-reader';
import BufferWriter from './buffer-writer';

export default class Signature {
  constructor(public readonly Type: number, public readonly Signature: Buffer) {}

  static fromBuffer(buffer: Buffer) {
    return Signature.fromBufferReader(new BufferReader(buffer));
  }

  static fromBufferReader(reader: BufferReader) {
    const buffer = reader.readBytes();
    return new Signature(buffer[0], buffer.slice(1));
  }

  toBuffer() {
    const writer = new BufferWriter();
    this.toBufferWriter(writer);
    return writer.toBuffer();
  }

  toBufferWriter(writer: BufferWriter) {
    writer.writeBytes(Buffer.concat([Buffer.from([this.Type]), this.Signature]));
  }
}
