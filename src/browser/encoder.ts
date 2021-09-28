import * as assert from 'assert';
import BigNumber from 'bignumber.js';
import Address from './address';
import { AMTType } from './amt';
import BufferWriter from './buffer-writer';
import Cid from './cid';
import { HAMTType } from './hamt';
import { DecodedParamType, OptionalParam, ParamType } from './parameter';
import Signature from './signature';
import Bitfield from './bitfield';

export function encodeParamsToWriter<T extends ParamType>(writer: BufferWriter, parameter: DecodedParamType<T>, paramType: T) {
  if (paramType instanceof OptionalParam) {
    if (parameter == null) {
      writer.writeNull();
    } else {
      encodeParamsToWriter(writer, parameter, paramType.Type);
    }
  } else if (typeof paramType === 'string') {
    switch (paramType) {
      case 'address':
        writer.writeAddress(parameter as Address);
        break;
      case 'bigint':
        writer.writeBigInt(parameter as BigNumber);
        break;
      case 'bitfield':
        writer.writeBitfield(parameter as Bitfield);
        break;
      case 'boolean':
        writer.writeBoolean(parameter as boolean);
        break;
      case 'buffer':
        writer.writeBytes(parameter as Buffer);
        break;
      case 'cid':
        writer.writeCid(parameter as Cid);
        break;
      case 'number':
        writer.writeNumber(parameter as number);
        break;
      case 'signaure':
        writer.writeSignature(parameter as Signature);
        break;
      case 'string':
        writer.writeString(parameter as string);
        break;
      default:
        throw `Invalid type ${paramType}`;
    }
  } else if (paramType instanceof AMTType || paramType instanceof HAMTType) {
    // Unreachable
  } else if (Array.isArray(paramType)) {
    assert.ok(Array.isArray(parameter));
    writer.writeArrayLength(parameter.length);
    for (const p of parameter) {
      encodeParamsToWriter(writer, p, paramType[0]);
    }
  } else {
    const parameterObject = parameter as Record<string, any>;
    writer.writeArrayLength(Object.keys(paramType).length);
    for (const [name, type] of Object.entries(paramType)) {
      encodeParamsToWriter(writer, parameterObject[name], type);
    }
  }
}

export default function encodeParams<T extends ParamType>(parameter: DecodedParamType<T>, paramType: T) {
  const writer = new BufferWriter();
  encodeParamsToWriter(writer, parameter, paramType);
  return writer.toBuffer();
}
