import { Buffer } from 'buffer';
import * as varint from 'varint';
import * as base32 from 'base32.js';
import { blake2b } from 'blakejs';

const addressPrefix = 'f';

export default class Address {
  constructor(public readonly protocol: number, public data: Buffer) { }

  static fromBuffer(buffer: Buffer) {
    return new Address(buffer[0], buffer.slice(1));
  }

  static fromString(string: string) {
    if (string[1] === '0') {
      const buffer: number[] = [];
      let n = Number(string.slice(2));
      if (n === 0) {
        return new Address(0, Buffer.from([0]));
      }
      while (n) {
        buffer.push(n & 0x7f);
        n >>>= 7;
      }
      for (let i = 0; i < buffer.length - 1; ++i) {
        buffer[i] |= 0x80;
      }
      return new Address(0, Buffer.from(buffer));
    } else {
      const buffer: Buffer = new base32.Decoder().write(string.slice(2)).finalize();
      return new Address(Number(string[1]), buffer.slice(0, -4));
    }
  }

  toBuffer() {
    return Buffer.concat([Buffer.from([this.protocol]), Buffer.from(this.data)]);
  }

  toString() {
    if (this.data.length === 0) {
      return '';
    }

    let string: string;
    if (this.protocol === 0) {
      let result = 0;
      for (let i = 0; i < this.data.length; ++i) {
        result |= (this.data[i] & 0x7f) << 7 * i;
        if (this.data[i] < 0x80) {
          break;
        }
      }
      string = result.toString();
    } else {
      string = '';
      const checksum = blake2b(Buffer.from([this.protocol, ...this.data]), null, 4);
      if (this.protocol === 4) {
        const namespace = varint.decode(this.data);
        const n = varint.decode.bytes;
        this.data = this.data.slice(n);
        string = `${namespace}f`;
      }
      string += new base32.Encoder({ type: 'rfc4648', lc: true })
        .write(this.data)
        .write(checksum)
        .finalize();
    }
    return addressPrefix + this.protocol + string;
  }
}
