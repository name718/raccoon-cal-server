import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import ObsClient from 'esdk-obs-nodejs';
import { config } from '@/config';
import { logger } from '@/utils/logger';

type StorageProvider = 'local' | 'obs';

interface UploadImageInput {
  buffer: Buffer;
  contentType: string;
  originalFilename?: string;
  requestOrigin: string;
  folder: string;
  userId: number;
}

interface UploadImageResult {
  imageUrl: string;
  objectKey: string;
  provider: StorageProvider;
}

interface DownloadImageResult {
  body: Buffer;
  contentType: string;
  contentLength?: number;
}

interface ObsResult {
  CommonMsg?: {
    Status?: number;
    Code?: string;
    Message?: string;
  };
  InterfaceResult?: {
    Content?: Readable;
    ContentType?: string;
    ContentLength?: string;
  };
}

let obsClient: ObsClient | null = null;

function hasObsError(result: ObsResult | null | undefined): boolean {
  const status = result?.CommonMsg?.Status;
  return status === undefined || status >= 300;
}

function getStorageProvider(): StorageProvider {
  return config.upload.provider === 'obs' ? 'obs' : 'local';
}

function normalizeObsServer(server: string): string {
  if (server.startsWith('http://') || server.startsWith('https://')) {
    return server.replace(/\/+$/, '');
  }
  return `https://${server.replace(/\/+$/, '')}`;
}

function ensureObsConfig() {
  const { accessKeyId, secretAccessKey, server, bucket } = config.obs;
  if (!accessKeyId || !secretAccessKey || !server || !bucket) {
    const error = new Error(
      'OBS 配置不完整，请检查 OBS_ACCESS_KEY_ID / OBS_SECRET_ACCESS_KEY / OBS_SERVER / OBS_BUCKET'
    );
    (error as Error & { code?: string }).code = 'OBS_CONFIG_MISSING';
    throw error;
  }
}

function getObsClient() {
  ensureObsConfig();

  if (!obsClient) {
    obsClient = new ObsClient({
      access_key_id: config.obs.accessKeyId,
      secret_access_key: config.obs.secretAccessKey,
      server: normalizeObsServer(config.obs.server as string),
    });
  }

  return obsClient;
}

function extensionFor(contentType: string, originalFilename?: string): string {
  const byMimeType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };

  const mapped = byMimeType[contentType];
  if (mapped) {
    return mapped;
  }

  const ext = originalFilename
    ? path.extname(originalFilename).replace('.', '').toLowerCase()
    : '';

  return ext || 'jpg';
}

function normalizeFolder(folder: string): string {
  return folder.replace(/^\/+|\/+$/g, '');
}

function buildObjectKey(
  folder: string,
  userId: number,
  extension: string
): string {
  const prefix = config.obs.keyPrefix.replace(/^\/+|\/+$/g, '');
  const parts = [
    prefix,
    normalizeFolder(folder),
    `food-${userId}-${Date.now()}-${randomUUID()}.${extension}`,
  ].filter(Boolean);
  return parts.join('/');
}

function buildObsPublicUrl(objectKey: string): string {
  if (!config.obs.server || !config.obs.bucket) {
    return '';
  }

  if (config.obs.publicBaseUrl) {
    return `${config.obs.publicBaseUrl.replace(/\/+$/, '')}/${objectKey}`;
  }

  const server = normalizeObsServer(config.obs.server as string);
  const serverUrl = new URL(server);
  const bucket = config.obs.bucket as string;
  return `${serverUrl.protocol}//${bucket}.${serverUrl.host}/${objectKey}`;
}

function buildProxyImageUrl(requestOrigin: string, objectKey: string): string {
  return `${requestOrigin}/media/${encodeObjectKey(objectKey)}`;
}

async function uploadToLocal(
  input: UploadImageInput,
  objectKey: string
): Promise<UploadImageResult> {
  const uploadDir = path.join(
    process.cwd(),
    'uploads',
    path.dirname(objectKey)
  );
  await mkdir(uploadDir, { recursive: true });

  const localPath = path.join(process.cwd(), 'uploads', objectKey);
  await writeFile(localPath, input.buffer);

  return {
    imageUrl: buildProxyImageUrl(input.requestOrigin, objectKey),
    objectKey,
    provider: 'local',
  };
}

async function uploadToObs(
  input: UploadImageInput,
  objectKey: string
): Promise<UploadImageResult> {
  const client = getObsClient();
  const result: ObsResult = await client.putObject({
    Bucket: config.obs.bucket,
    Key: objectKey,
    Body: input.buffer,
    ContentType: input.contentType,
  });

  if (hasObsError(result)) {
    logger.error('storage.service: OBS upload failed', {
      status: result?.CommonMsg?.Status,
      code: result?.CommonMsg?.Code,
      message: result?.CommonMsg?.Message,
      objectKey,
    });

    const error = new Error(result?.CommonMsg?.Message || 'OBS 上传失败');
    (error as Error & { code?: string }).code = 'OBS_UPLOAD_FAILED';
    throw error;
  }

  return {
    imageUrl: buildProxyImageUrl(input.requestOrigin, objectKey),
    objectKey,
    provider: 'obs',
  };
}

export async function uploadFoodRecordImage(
  input: UploadImageInput
): Promise<UploadImageResult> {
  const extension = extensionFor(input.contentType, input.originalFilename);
  const objectKey = buildObjectKey(input.folder, input.userId, extension);
  const provider = getStorageProvider();

  const result =
    provider === 'obs'
      ? await uploadToObs(input, objectKey)
      : await uploadToLocal(input, objectKey);

  logger.info('storage.service: image uploaded', {
    provider: result.provider,
    objectKey: result.objectKey,
    userId: input.userId,
  });

  return result;
}

export function encodeObjectKey(objectKey: string): string {
  return Buffer.from(objectKey, 'utf8').toString('base64url');
}

export function decodeObjectKey(encodedKey: string): string {
  return Buffer.from(encodedKey, 'base64url').toString('utf8');
}

function contentTypeFromKey(objectKey: string): string {
  const ext = path.extname(objectKey).replace('.', '').toLowerCase();
  const byExt: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  return byExt[ext] ?? 'application/octet-stream';
}

async function readFromLocal(objectKey: string): Promise<DownloadImageResult> {
  const filePath = path.join(process.cwd(), 'uploads', objectKey);
  const body = await readFile(filePath);
  return {
    body,
    contentType: contentTypeFromKey(objectKey),
    contentLength: body.length,
  };
}

async function readFromObs(objectKey: string): Promise<DownloadImageResult> {
  const client = getObsClient();
  const result: ObsResult = await client.getObject({
    Bucket: config.obs.bucket,
    Key: objectKey,
    SaveAsStream: true,
  });

  if (hasObsError(result)) {
    logger.error('storage.service: OBS read failed', {
      status: result?.CommonMsg?.Status,
      code: result?.CommonMsg?.Code,
      message: result?.CommonMsg?.Message,
      objectKey,
    });

    const error = new Error(result?.CommonMsg?.Message || 'OBS 读取失败');
    (error as Error & { code?: string }).code = 'OBS_READ_FAILED';
    throw error;
  }

  const stream = result.InterfaceResult?.Content;
  if (!stream) {
    const error = new Error('OBS 返回内容为空');
    (error as Error & { code?: string }).code = 'OBS_READ_FAILED';
    throw error;
  }

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on('end', () => resolve());
    stream.on('error', (error: Error) => reject(error));
  });

  const body = Buffer.concat(chunks);
  const parsedContentLength = parseInt(
    result.InterfaceResult?.ContentLength ?? String(body.length),
    10
  );
  const contentLength = parsedContentLength || body.length;

  return {
    body,
    contentType:
      result.InterfaceResult?.ContentType || contentTypeFromKey(objectKey),
    contentLength,
  };
}

export async function getFoodRecordImage(
  objectKey: string
): Promise<DownloadImageResult> {
  const provider = getStorageProvider();
  return provider === 'obs' ? readFromObs(objectKey) : readFromLocal(objectKey);
}

export function resolveImageUrlThroughProxy(
  storedImageUrl: string | null | undefined,
  requestOrigin: string
): string | null {
  if (!storedImageUrl) {
    return null;
  }

  if (storedImageUrl.startsWith(`${requestOrigin}/media/`)) {
    return storedImageUrl;
  }

  if (storedImageUrl.startsWith('/uploads/')) {
    return buildProxyImageUrl(
      requestOrigin,
      storedImageUrl.replace(/^\/uploads\//, '')
    );
  }

  if (storedImageUrl.startsWith(`${requestOrigin}/uploads/`)) {
    return buildProxyImageUrl(
      requestOrigin,
      storedImageUrl.replace(`${requestOrigin}/uploads/`, '')
    );
  }

  const obsPublicBaseUrl = config.obs.publicBaseUrl?.replace(/\/+$/, '');
  if (obsPublicBaseUrl && storedImageUrl.startsWith(`${obsPublicBaseUrl}/`)) {
    return buildProxyImageUrl(
      requestOrigin,
      storedImageUrl.replace(`${obsPublicBaseUrl}/`, '')
    );
  }

  const computedObsBaseUrl = buildObsPublicUrl('').replace(/\/$/, '');
  if (
    computedObsBaseUrl &&
    storedImageUrl.startsWith(`${computedObsBaseUrl}/`)
  ) {
    return buildProxyImageUrl(
      requestOrigin,
      storedImageUrl.replace(`${computedObsBaseUrl}/`, '')
    );
  }

  return storedImageUrl;
}
