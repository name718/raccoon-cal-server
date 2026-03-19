declare module 'esdk-obs-nodejs' {
  import type { Readable } from 'node:stream';

  interface ObsClientOptions {
    access_key_id?: string;
    secret_access_key?: string;
    server?: string;
  }

  interface PutObjectInput {
    Bucket?: string;
    Key?: string;
    Body?: Buffer;
    ContentType?: string;
  }

  interface GetObjectInput {
    Bucket?: string;
    Key?: string;
    SaveAsStream?: boolean;
  }

  interface ObsCommonMsg {
    Status?: number;
    Code?: string;
    Message?: string;
  }

  interface ObsInterfaceResult {
    Content?: Readable;
    ContentType?: string;
    ContentLength?: string;
  }

  interface ObsResult {
    CommonMsg?: ObsCommonMsg;
    InterfaceResult?: ObsInterfaceResult;
  }

  export default class ObsClient {
    constructor(options: ObsClientOptions);

    putObject(params: PutObjectInput): Promise<ObsResult>;

    getObject(params: GetObjectInput): Promise<ObsResult>;
  }
}
