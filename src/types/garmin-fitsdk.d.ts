declare module "@garmin/fitsdk" {
  export class Encoder {
    constructor(options?: { fieldDescriptions?: unknown });
    writeMesg(mesg: { mesgNum: number } & Record<string, unknown>): this;
    onMesg(mesgNum: number, mesg: Record<string, unknown>): this;
    close(): Uint8Array;
    addDeveloperField(key: string, developerDataIdMesg: unknown, fieldDescriptionMesg: unknown): void;
  }
  export class Decoder {
    constructor(stream: unknown);
  }
  export class Stream {
    constructor(buffer: ArrayBufferLike | Uint8Array);
  }
  export const CrcCalculator: unknown;
  export const Profile: unknown;
  export const Utils: unknown;
}
