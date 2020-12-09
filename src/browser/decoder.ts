import * as assert from 'assert';
import { Buffer } from 'buffer';
import { AMTType } from './amt';
import BufferReader from './buffer-reader';
import { HAMTType } from './hamt';
import { DecodedParamType, OptionalParam, ParamType } from './parameter';

export function decodeParamsFromReader<T extends ParamType>(reader: BufferReader, paramType: T): DecodedParamType<T>;
export function decodeParamsFromReader(reader: BufferReader, paramType: ParamType) {
  if (paramType instanceof OptionalParam) {
    return reader.readNull() ? null : decodeParamsFromReader(reader, paramType.Type);
  } else if (typeof paramType === 'string') {
    switch (paramType) {
      case 'address':
        return reader.readAddress();
      case 'bigint':
        return reader.readBigInt();
      case 'bitfield':
        return reader.readBitfield();
      case 'boolean':
        return reader.readBoolean();
      case 'buffer':
        return reader.readBytes();
      case 'cid':
        return reader.readCid();
      case 'number':
        return reader.readNumber();
      case 'signature':
        return reader.readSignature();
      case 'string':
        return reader.readString();
      default:
        throw `Invalid type ${paramType}`;
    }
  } else if (paramType instanceof AMTType) {
    return reader.readAMT(paramType);
  } else if (paramType instanceof HAMTType) {
    return reader.readHAMT(paramType);
  } else {
    const length = reader.readArrayLength();
    if (Array.isArray(paramType)) {
      const list = [];
      for (let i = 0; i < length; ++i) {
        list.push(decodeParamsFromReader(reader, paramType[0]));
      }
      return list;
    } else {
      assert.strictEqual(length, Object.keys(paramType).length);
      const result: Record<string, any> = {};
      for (const [name, type] of Object.entries(paramType)) {
        result[name] = decodeParamsFromReader(reader, type);
      }
      return result;
    }
  }
}

export default function decodeParams<T extends ParamType>(params: Buffer, paramType: T) {
  return decodeParamsFromReader(new BufferReader(params), paramType);
}
