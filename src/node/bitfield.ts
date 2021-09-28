import * as assert from 'assert';

class BitBufferReader {
  private offset = 0;

  constructor(private buffer: Buffer) {}

  get finished() {
    return this.buffer.length === 0 || this.buffer.length === 1 && this.buffer[0] >>> this.offset === 0;
  }

  read(length: number) {
    let n = this.buffer[0] >>> this.offset;
    const totalOffset = this.offset + length;
    if (totalOffset <= 8) {
      n &= (1 << length) - 1;
    } else {
      n |= (this.buffer[1] & (1 << totalOffset - 8) - 1) << 8 - this.offset;
    }
    if (totalOffset >= 8) {
      this.buffer = this.buffer.slice(1);
    }
    this.offset = totalOffset & 7;
    return n;
  }
}

class BitBufferWriter {
  private bits = 0;
  private bitCap = 0;

  constructor(private buffer: number[]) {}

  write(val: number, length: number) {
    this.bits |= val << this.bitCap;
    this.bitCap += length;
    if (this.bitCap >= 8) {
      this.buffer.push(this.bits & 0xff);
      this.bits >>= 8;
      this.bitCap -= 8;
    }
  }

  finish() {
    this.buffer.push(this.bits & 0xff);
  }

  get data() {
    return Buffer.from(this.buffer);
  }
}

export default class Bitfield {
  private constructor(private _chunks: number[]) {}

  static fromBuffer(buffer: Buffer) {
    if (buffer.length === 0) {
      return new Bitfield([]);
    }
    const reader = new BitBufferReader(buffer);
    assert.strictEqual(reader.read(2), 0);
    const chunks: number[] = [];
    if (reader.read(1)) {
      chunks.push(0);
    }
    while (!reader.finished) {
      if (reader.read(1)) {
        chunks.push(1);
        // eslint-disable-next-line no-dupe-else-if
      } else if (reader.read(1)) {
        chunks.push(reader.read(4));
      } else {
        let n = 0;
        for (let i = 0; ; ++i) {
          const x = reader.read(8);
          n += (x & 0x7f) * 2 ** (7 * i);
          if (x < 0x80) {
            break;
          }
        }
        chunks.push(n);
      }
    }
    return new Bitfield(chunks);
  }

  // convert number to Bitfield for single sectorID
  static fromNumber(data: number) {
    if (data === null || data === undefined) {
      return new Bitfield([]);
    }
    const chunks: number[] = [];
    chunks.push(data);
    chunks.push(1);
    return new Bitfield(chunks);
  }

  // convert number array to Bitfield for sequence sectorID
  static fromNumberArray(data: number[]) {
    if (data === null || data === undefined || data.length === 0) {
      return new Bitfield([]);
    }
    data.sort((a, b) => a - b);
    const chunks: number[] = [];
    let offset = 0;
    let before = data[0] - 1;
    chunks.push(data[0]);
    for (let i = 0; i < data.length; i++) {
      if (data[i] === before + 1) {
        before = data[i];
        offset += 1;
      } else {
        chunks.push(offset);
        chunks.push(data[i] - before - offset);
        offset = 1;
        before = data[i];
      }
    }
    if (offset !== 0) {
      chunks.push(offset);
    }
    return new Bitfield(chunks);
  }

  get chunks() {
    return this._chunks;
  }

  getRanges() {
    let currentValue = false;
    let offset = 0;
    const ranges: {from: number; to: number}[] = [];
    for (const length of this._chunks) {
      if (currentValue) {
        ranges.push({ from: offset, to: offset + length - 1 });
      }
      currentValue = !currentValue;
      offset += length;
    }
    return ranges;
  }

  computeLength(varBuf: number[], x: number) {
    let i = 0;
    while (x >= 0x80) {
      varBuf[i] = x & 0xff | 0x80;
      x >>= 7;
      i++;
    }
    varBuf[i] = x;
    return i + 1;
  }

  toBuffer() {
    if (this.chunks.length === 0) {
      return Buffer.from([]);
    }
    const writer = new BitBufferWriter([]);
    writer.write(0, 2);
    if (this.chunks[0] === 0) {
      writer.write(1, 1);
    } else {
      writer.write(0, 1);
    }

    const varBuf: number[] = [];
    for (let i = 0; i < this.chunks.length; i++) {
      const num = this.chunks[i];
      if (num === 1) {
        writer.write(1, 1);
      } else if (num < 16) {
        writer.write(2, 2);
        writer.write(num & 0xff, 4);
      } else if (num >= 16) {
        writer.write(0, 2);
        const len = this.computeLength(varBuf, num);
        for (let j = 0; j < len; j++) {
          writer.write(varBuf[j], 8);
        }
      }
    }
    writer.finish();
    return writer.data;
  }
}
