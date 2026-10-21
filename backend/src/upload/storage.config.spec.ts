import { storageConfiguration } from './storage.config';

describe('storage instance configuration', () => {
  const cloud = {
    type: 's3',
    endpoint: 'https://cos.ap-guangzhou.myqcloud.com',
    region: 'ap-guangzhou',
    bucket: 'photos-1250000000',
    accessKeyId: 'fixture-key',
    secretAccessKey: 'fixture-secret',
  };
  const read = (values: Record<string, unknown>) =>
    storageConfiguration((key) => values[key]);
  it('keeps the default local instance and derives its public URL', () => {
    expect(read({ APP_URL: 'https://api.example.test' })).toEqual({
      defaultId: 'local',
      instances: {
        local: {
          type: 'local',
          path: './uploads',
          publicBaseUrl: 'https://api.example.test/images',
        },
      },
    });
  });
  it('configures multiple S3 instances and selects one default without merging buckets', () => {
    const aws = {
      ...cloud,
      endpoint: 'https://s3.ap-southeast-1.amazonaws.com',
      region: 'ap-southeast-1',
      bucket: 'aws-photos',
    };
    const result = read({
      UPLOAD_DEFAULT_STORAGE_ID: 'cos-main',
      UPLOAD_STORAGE_INSTANCES: JSON.stringify({
        'aws-main': aws,
        'cos-main': cloud,
      }),
    });
    expect(result.defaultId).toBe('cos-main');
    expect(result.instances['aws-main']).toEqual(aws);
    expect(result.instances['cos-main']).toEqual(cloud);
  });
  it('maps existing OSS credentials and retains its private object ACL', () => {
    const result = read({
      UPLOAD_STORAGE_TYPE: 'oss',
      OSS_REGION: 'oss-cn-shanghai',
      OSS_BUCKET: 'legacy-photos',
      OSS_ACCESS_KEY_ID: 'legacy-key',
      OSS_ACCESS_KEY_SECRET: 'legacy-secret',
      OSS_CUSTOM_DOMAIN: 'https://images.example.test/media/',
    });
    expect(result.defaultId).toBe('oss');
    expect(result.instances.oss).toEqual({
      type: 's3',
      endpoint: 'https://s3.oss-cn-shanghai.aliyuncs.com',
      region: 'cn-shanghai',
      bucket: 'legacy-photos',
      accessKeyId: 'legacy-key',
      secretAccessKey: 'legacy-secret',
      publicBaseUrl: 'https://images.example.test/media/',
      privateObjectAcl: 'private',
    });
  });
  it('retains complete legacy S3 configuration for historical records', () => {
    expect(
      read({
        S3_ENDPOINT: cloud.endpoint,
        S3_REGION: cloud.region,
        S3_BUCKET: cloud.bucket,
        S3_ACCESS_KEY_ID: cloud.accessKeyId,
        S3_SECRET_ACCESS_KEY: cloud.secretAccessKey,
        S3_FORCE_PATH_STYLE: 'false',
      }).instances.s3,
    ).toEqual({ ...cloud, forcePathStyle: false });
  });
  it.each(['local', 'oss', 's3'])(
    'reserves legacy ID %s instead of retargeting existing records',
    (id) => {
      expect(() =>
        read({ UPLOAD_STORAGE_INSTANCES: JSON.stringify({ [id]: cloud }) }),
      ).toThrow('reserved');
    },
  );
  it('rejects unknown defaults and malformed profiles without exposing secrets', () => {
    expect(() => read({ UPLOAD_DEFAULT_STORAGE_ID: 'missing' })).toThrow(
      'UPLOAD_DEFAULT_STORAGE_ID',
    );
    for (const value of [
      '{private-secret',
      '[]',
      JSON.stringify({
        cloud: {
          ...cloud,
          endpoint: 'https://user:private-secret@example.test',
        },
      }),
      JSON.stringify({ cloud: { ...cloud, forcePathStyle: 'false' } }),
      JSON.stringify({ cloud: { ...cloud, privateObjectAcl: 'public-read' } }),
    ]) {
      try {
        read({ UPLOAD_STORAGE_INSTANCES: value });
        throw new Error('Expected validation failure');
      } catch (error) {
        expect(String(error)).toContain('UPLOAD_STORAGE_INSTANCES');
        expect(String(error)).not.toContain('private-secret');
        expect(String(error)).not.toContain('fixture-secret');
      }
    }
  });
});
