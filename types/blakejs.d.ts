declare module 'blakejs' {
  function blake2b(input: ArrayLike<number>, key: ArrayLike<number> | null | undefined, length: number | null | undefined): Uint8Array;
  function blake2s(input: ArrayLike<number>, key: ArrayLike<number> | null | undefined, length: number | null | undefined): Uint8Array;
}
