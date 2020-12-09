import * as assert from 'assert';
import { Buffer } from 'buffer';

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
          n |= (x & 0x7f) << 7 * i;
          if (x < 0x80) {
            break;
          }
        }
        chunks.push(n);
      }
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
}
