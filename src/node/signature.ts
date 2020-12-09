import BufferReader from './buffer-reader';

export default class Signature {
  constructor(private readonly type: number, private readonly signature: Buffer) {}

  static fromBuffer(buffer: Buffer) {
    return Signature.fromBufferReader(new BufferReader(buffer));
  }

  static fromBufferReader(reader: BufferReader) {
    const buffer = reader.readBytes();
    return new Signature(buffer[0], buffer.slice(1));
  }

  get Type() {
    return this.type;
  }

  get Signature() {
    return this.signature;
  }
}
