import Ajv from 'ajv';
import { booleanSetting } from '@/common/utils/boolean-setting';

export interface LocalStorageConfiguration {
  type: 'local';
  path: string;
  publicBaseUrl: string;
}

export interface S3StorageConfiguration {
  type: 's3';
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  forcePathStyle?: boolean;
  publicBaseUrl?: string;
  privateObjectAcl?: 'private';
}

export type StorageInstanceConfiguration =
  | LocalStorageConfiguration
  | S3StorageConfiguration;
export interface StorageConfiguration {
  defaultId: string;
  instances: Record<string, StorageInstanceConfiguration>;
}

function storageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

const ajv = new Ajv();
ajv.addFormat('storage-url', storageUrl);
const text = { type: 'string', pattern: '\\S' };
const url = { type: 'string', format: 'storage-url' };
const validateInstance = ajv.compile<StorageInstanceConfiguration>({
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'path', 'publicBaseUrl'],
      properties: { type: { const: 'local' }, path: text, publicBaseUrl: url },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: [
        'type',
        'endpoint',
        'region',
        'bucket',
        'accessKeyId',
        'secretAccessKey',
      ],
      properties: {
        type: { const: 's3' },
        endpoint: url,
        region: text,
        bucket: text,
        accessKeyId: text,
        secretAccessKey: text,
        sessionToken: text,
        forcePathStyle: { type: 'boolean' },
        publicBaseUrl: url,
        privateObjectAcl: { const: 'private' },
      },
    },
  ],
});

export function storageConfiguration(
  get: (key: string) => unknown,
): StorageConfiguration {
  const setting = (key: string, fallback?: string): string | undefined => {
    const value = get(key) ?? fallback;
    if (value === undefined) return undefined;
    if (typeof value !== 'string') throw new Error(`${key} must be a string`);
    return value;
  };
  const required = (key: string): string => {
    const value = setting(key);
    if (!value?.trim()) throw new Error(`${key} is required`);
    return value;
  };
  const explicitDefault = get('UPLOAD_DEFAULT_STORAGE_ID');
  const defaultKey =
    explicitDefault == null
      ? 'UPLOAD_STORAGE_TYPE'
      : 'UPLOAD_DEFAULT_STORAGE_ID';
  const defaultId = setting(defaultKey, 'local')!;
  if (
    defaultKey === 'UPLOAD_STORAGE_TYPE' &&
    !['local', 'oss', 's3'].includes(defaultId)
  )
    throw new Error('UPLOAD_STORAGE_TYPE must be local, oss or s3');
  const instances: Record<string, StorageInstanceConfiguration> = {
    local: {
      type: 'local',
      path: setting('UPLOAD_LOCAL_PATH', './uploads')!,
      publicBaseUrl:
        setting('UPLOAD_BASE_URL') ??
        `${setting('APP_URL', 'http://localhost:3000')}/images`,
    },
  };
  const ossKeys = [
    'OSS_REGION',
    'OSS_ACCESS_KEY_ID',
    'OSS_ACCESS_KEY_SECRET',
    'OSS_BUCKET',
  ];
  const s3Keys = [
    'S3_ENDPOINT',
    'S3_REGION',
    'S3_BUCKET',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
  ];
  if (defaultId === 'oss') ossKeys.forEach(required);
  if (defaultId === 's3') s3Keys.forEach(required);
  const complete = (keys: string[]) =>
    keys.every(
      (key) => typeof get(key) === 'string' && (get(key) as string).trim(),
    );
  if (complete(ossKeys)) {
    const region = required('OSS_REGION').replace(/^oss-/, '');
    const publicBaseUrl = setting('OSS_CUSTOM_DOMAIN');
    instances.oss = {
      type: 's3',
      endpoint: `https://s3.oss-${region}.aliyuncs.com`,
      region,
      bucket: required('OSS_BUCKET'),
      accessKeyId: required('OSS_ACCESS_KEY_ID'),
      secretAccessKey: required('OSS_ACCESS_KEY_SECRET'),
      privateObjectAcl: 'private',
      ...(publicBaseUrl ? { publicBaseUrl } : {}),
    };
  }
  if (complete(s3Keys)) {
    for (const key of ['S3_ENDPOINT', 'S3_PUBLIC_BASE_URL']) {
      const value = setting(key);
      if (value && !storageUrl(value))
        throw new Error(
          `${key} must be an http(s) URL without credentials, query or fragments`,
        );
    }
    const publicBaseUrl = setting('S3_PUBLIC_BASE_URL');
    const sessionToken = setting('S3_SESSION_TOKEN');
    instances.s3 = {
      type: 's3',
      endpoint: required('S3_ENDPOINT'),
      region: required('S3_REGION'),
      bucket: required('S3_BUCKET'),
      accessKeyId: required('S3_ACCESS_KEY_ID'),
      secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
      forcePathStyle: booleanSetting(
        get('S3_FORCE_PATH_STYLE'),
        'S3_FORCE_PATH_STYLE',
      ),
      ...(publicBaseUrl ? { publicBaseUrl } : {}),
      ...(sessionToken ? { sessionToken } : {}),
    };
  }
  const raw = get('UPLOAD_STORAGE_INSTANCES');
  if (raw !== undefined && raw !== null && raw !== '') {
    let parsed: unknown;
    try {
      if (typeof raw !== 'string') throw new Error();
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('UPLOAD_STORAGE_INSTANCES must be a JSON object');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('UPLOAD_STORAGE_INSTANCES must be a JSON object');
    for (const [id, value] of Object.entries(parsed)) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id))
        throw new Error(
          'UPLOAD_STORAGE_INSTANCES IDs must use 1-64 letters, numbers, hyphens or underscores, starting with a letter or number',
        );
      if (['local', 'oss', 's3'].includes(id))
        throw new Error(
          'UPLOAD_STORAGE_INSTANCES IDs local, oss and s3 are reserved for legacy configuration',
        );
      if (!validateInstance(value))
        throw new Error(
          `UPLOAD_STORAGE_INSTANCES: ${validateInstance.errors?.map((error) => error.message).join('; ')}`,
        );
      instances[id] = value;
    }
  }
  if (!Object.hasOwn(instances, defaultId))
    throw new Error(
      `${defaultKey} must identify a configured storage instance`,
    );
  return { defaultId, instances };
}
