declare module "pako" {
  export function ungzip(data: Uint8Array | ArrayBuffer | Buffer): Uint8Array;
}
