import { Buffer } from 'buffer';
import * as base32 from 'base32.js';
import { blake2b } from 'blakejs';

const addressPrefix = 'f';

export default class Address {
  constructor(private readonly _protocol: number, private readonly _data: Buffer) {}

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

  get protocol() {
    return this._protocol;
  }

  get data() {
    return this._data;
  }

  toString() {
    let string: string;
    if (this._protocol === 0) {
      let result = 0;
      for (let i = 0; i < this._data.length; ++i) {
        result |= (this._data[i] & 0x7f) << 7 * i;
        if (this._data[i] < 0x80) {
          break;
        }
      }
      string = result.toString();
    } else {
      const checksum = blake2b(Buffer.from([this._protocol, ...this._data]), null, 4);
      string = new base32.Encoder({ type: 'rfc4648', lc: true })
        .write(this._data)
        .write(checksum)
        .finalize();
    }
    return addressPrefix + this._protocol + string;
  }
}
