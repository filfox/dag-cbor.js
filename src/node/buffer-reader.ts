import * as assert from 'assert';
import Address from './address';
import AMT, { AMTType } from './amt';
import BitField from './bitfield';
import Cid from './cid';
import { decodeParamsFromReader } from './decoder';
import HAMT, { HAMTKey, HAMTType, HAMTVersion } from './hamt';
import { ParamType } from './parameter';
import Signature from './signature';

export default class BufferReader {
  constructor(private buffer: Buffer) {}

  get length() {
    return this.buffer.length;
  }

  get finished() {
    return this.buffer.length === 0;
  }

  read(length: number) {
    const buffer = this.buffer.slice(0, length);
    this.skip(length);
    return buffer;
  }

  readAll() {
    const buffer = this.buffer;
    this.buffer = Buffer.alloc(0);
    return buffer;
  }

  readHeader() {
    const byte = this.readByte();
    const majority = (byte & 0xe0) >>> 5;
    const m = byte & 0x1f;
    if (m < 24) {
      return { majority, extra: m };
    } else if (m === 24) {
      const n = this.readByte();
      return { majority, extra: n };
    } else if (m === 25) {
      const n = this.buffer.readUInt16BE(0);
      this.skip(2);
      return { majority, extra: n };
    } else if (m === 26) {
      const n = this.buffer.readUInt32BE(0);
      this.skip(4);
      return { majority, extra: n };
    } else if (m === 27) {
      const n = this.buffer.readBigUInt64BE(0);
      this.skip(8);
      return { majority, extra: Number(n) };
    } else {
      throw 'Failed to read header';
    }
  }

  readBoolean() {
    const { majority, extra } = this.readHeader();
    assert.strictEqual(majority, 7);
    if (extra === 20) {
      return false;
    } else if (extra === 21) {
      return true;
    } else {
      throw 'Invalid boolean value';
    }
  }

  readNumber() {
    const { majority, extra } = this.readHeader();
    if (majority === 0) {
      return extra;
    } else if (majority === 1) {
      return -extra - 1;
    } else {
      throw 'Failed to read number';
    }
  }

  readBigInt() {
    const buffer = this.readBytes();
    if (buffer.length === 0) {
      return 0n;
    } else if (buffer[0] === 0) {
      return BigInt(`0x${buffer.toString('hex')}`);
    } else {
      return -BigInt(`0x${buffer.slice(1).toString('hex')}`);
    }
  }

  readAddress() {
    const buffer = this.readBytes();
    assert(buffer.length <= 64);
    return Address.fromBuffer(buffer);
  }

  readBytes() {
    const { majority, extra } = this.readHeader();
    assert.strictEqual(majority, 2);
    const buffer = this.read(extra);
    return buffer;
  }

  readString() {
    const { majority, extra } = this.readHeader();
    assert.strictEqual(majority, 3);
    const buffer = this.read(extra);
    return buffer.toString();
  }

  readArrayLength() {
    const { majority, extra } = this.readHeader();
    assert.strictEqual(majority, 4);
    return extra;
  }

  readCid() {
    return Cid.fromBufferReader(this);
  }

  readBitfield() {
    const buffer = this.readBytes();
    return BitField.fromBuffer(buffer);
  }

  readSignature() {
    return Signature.fromBufferReader(this);
  }

  readAMT<T extends ParamType>(type: AMTType<T>) {
    return AMT.fromBufferReader(this, type);
  }

  readHAMT<K extends HAMTKey, V extends ParamType>(type: HAMTType<K, V>, version: HAMTVersion = 3, bitWidth = 5) {
    return HAMT.fromBufferReader(this, type, version, bitWidth);
  }

  readNull() {
    if (this.buffer[0] === 0xf6) {
      this.skip(1);
      return true;
    } else {
      return false;
    }
  }

  readType<T extends ParamType>(type: T) {
    return decodeParamsFromReader(this, type);
  }

  push(buffer: Buffer) {
    this.buffer = Buffer.concat([this.buffer, buffer]);
  }

  slice(...args: number[]) {
    return this.buffer.slice(...args);
  }

  private readByte() {
    const byte = this.buffer[0];
    this.skip(1);
    return byte;
  }

  private skip(offset: number) {
    this.buffer = this.buffer.slice(offset);
  }
}
