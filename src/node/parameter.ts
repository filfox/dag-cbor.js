import Address from './address';
import AMT, { AMTType } from './amt';
import Bitfield from './bitfield';
import Cid from './cid';
import HAMT, { HAMTKey, HAMTType } from './hamt';
import Signature from './signature';

type ParamTypeMapping = {
  address: Address;
  bigint: bigint;
  bitfield: Bitfield;
  boolean: boolean;
  buffer: Buffer;
  cid: Cid;
  number: number;
  signature: Signature;
  string: string;
};

export class OptionalParam<T extends ParamType> {
  constructor(public Type: T) { }
}

type DecodedNonOptionalParamType<T extends ParamType> = T extends keyof ParamTypeMapping
  ? ParamTypeMapping[T]
  : T extends { [name: string]: ParamType }
    ? { -readonly [x in keyof T]: DecodedParamType<T[x]> }
    : T extends AMT<infer U>
      ? AMT<U>
      : T extends HAMTType<infer K, infer V>
        ? HAMT<K, V>
        : T extends readonly [infer U]
          ? (U extends ParamType ? DecodedParamType<U>[] : never)
          : never;

export type DecodedParamType<T extends ParamType> = T extends OptionalParam<infer U>
  ? DecodedNonOptionalParamType<U> | null
  : DecodedNonOptionalParamType<T>;

type NonOptionalParamType = keyof ParamTypeMapping
| { [name: string]: ParamType }
| AMTType<ParamType>
| HAMTType<HAMTKey, ParamType>
| readonly [ParamType];

export type ParamType = NonOptionalParamType | OptionalParam<NonOptionalParamType>;
