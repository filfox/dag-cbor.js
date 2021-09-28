import Address from './address';
import Bitfield from './bitfield';
import Cid from './cid';
import Signature from './signature';

export default class BufferWriter {
  private buffer: Buffer[] = [];

  toBuffer() {
    return Buffer.concat(this.buffer);
  }

  writeHeader(majority: number, extra: number) {
    if (extra < 24) {
      this.buffer.push(Buffer.from([majority << 5 | extra]));
    } else if (extra <= 0xff) {
      this.buffer.push(Buffer.from([majority << 5 | 24, extra]));
    } else if (extra <= 0xffff) {
      const buffer = Buffer.alloc(3);
      buffer[0] = majority << 5 | 25;
      buffer.writeUInt16BE(extra, 1);
      this.buffer.push(buffer);
    } else if (extra <= 0xffffffff) {
      const buffer = Buffer.alloc(3);
      buffer[0] = majority << 5 | 26;
      buffer.writeUInt32BE(extra, 1);
      this.buffer.push(buffer);
    } else {
      const buffer = Buffer.alloc(3);
      buffer[0] = majority << 5 | 27;
      buffer.writeBigUInt64BE(BigInt(extra), 1);
      this.buffer.push(buffer);
    }
  }

  writeBoolean(value: boolean) {
    this.writeHeader(7, value ? 21 : 20);
  }

  writeNumber(n: number) {
    if (n >= 0) {
      this.writeHeader(0, n);
    } else {
      this.writeHeader(1, -n - 1);
    }
  }

  writeBigInt(n: bigint) {
    if (n === 0n) {
      this.writeBytes(Buffer.alloc(0));
    } else {
      const signal = n > 0 ? 1 : -1;
      if (signal === -1) {
        n = -n;
      }
      const s = n.toString(16);
      this.writeBytes(Buffer.concat([
        Buffer.from([signal === 1 ? 0 : 1]),
        Buffer.from(s.length % 2 === 0 ? s : `0${s}`, 'hex'),
      ]));
    }
  }

  writeAddress(address: Address) {
    this.writeBytes(address.toBuffer());
  }

  writeBytes(buffer: Buffer) {
    this.writeHeader(2, buffer.length);
    this.buffer.push(buffer);
  }

  writeString(string: string) {
    this.writeHeader(3, string.length);
    this.buffer.push(Buffer.from(string));
  }

  writeArrayLength(length: number) {
    this.writeHeader(4, length);
  }

  writeCid(cid: Cid) {
    cid.toBufferWriter(this);
  }

  writeBitfield(bitfield: Bitfield) {
    this.writeBytes(bitfield.toBuffer());
  }

  writeSignature(signature: Signature) {
    signature.toBufferWriter(this);
  }

  writeNull() {
    this.writeHeader(7, 22);
  }
}
