import * as blake2 from 'blake2';
import * as base32 from 'base32.js';

const addressPrefix = 'f';

export default class Address {
  constructor(private readonly _protocol: number, private readonly _data: Buffer) {}

  static fromBuffer(buffer: Buffer) {
    return new Address(buffer[0], buffer.slice(1));
  }

  static fromString(string: string) {
    if (string[1] === '0') {
      const buffer: number[] = [];
      let n = BigInt(string.slice(2));
      while (n) {
        buffer.push(Number(n & 0x7fn));
        n >>= 7n;
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
      let result = 0n;
      for (let i = 0; i < this._data.length; ++i) {
        result |= BigInt(this._data[i] & 0x7f) << BigInt(7 * i);
        if (this._data[i] < 0x80) {
          break;
        }
      }
      string = result.toString();
    } else {
      const checksum = blake2.createHash('blake2b', { digestLength: 4 })
        .update(Buffer.from([this._protocol]))
        .update(this._data)
        .digest();
      string = new base32.Encoder({ type: 'rfc4648', lc: true })
        .write(this._data)
        .write(checksum)
        .finalize();
    }
    return addressPrefix + this._protocol + string;
  }
}
