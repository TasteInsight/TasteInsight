import { ConfigService } from '@nestjs/config';
import { S3StorageConfiguration } from '../storage.config';
import { StorageService } from '../storage.service';
import { S3Client } from '@aws-sdk/client-s3';
import { Agent, createServer, Server } from 'http';
import { AddressInfo, createConnection } from 'net';
import { S3StorageStrategy } from './s3-storage.strategy';

describe('S3 storage protocol', () => {
  let server: Server;
  let endpoint: string;
  const objects = new Map<string, Buffer>();
  const requests: {
    method: string;
    key: string;
    headers: import('http').IncomingHttpHeaders;
  }[] = [];
  let failPut = false;
  const config = (
    extra: Partial<S3StorageConfiguration> = {},
  ): S3StorageConfiguration => ({
    type: 's3',
    endpoint,
    region: 'ap-guangzhou',
    bucket: 'photos-1250000000',
    accessKeyId: 'fixture-key',
    secretAccessKey: 'fixture-secret',
    sessionToken: 'fixture-session',
    forcePathStyle: true,
    ...extra,
  });
  const file = {
    buffer: Buffer.from('normalized-image-bytes'),
    originalname: 'image.png',
    mimetype: 'image/png',
  } as Express.Multer.File;

  beforeAll(async () => {
    server = createServer((request, response) => {
      const key = new URL(request.url!, 'http://localhost').pathname;
      requests.push({ method: request.method!, key, headers: request.headers });
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        if (request.method === 'PUT') {
          if (failPut) {
            response.writeHead(403, { 'Content-Type': 'application/xml' });
            response.end(
              '<Error><Code>AccessDenied</Code><Message>denied</Message></Error>',
            );
            return;
          }
          objects.set(key, Buffer.concat(chunks));
        } else if (request.method === 'GET') {
          if (!objects.has(key)) {
            response.writeHead(404);
            response.end();
            return;
          }
          response.end(objects.get(key));
          return;
        } else if (request.method === 'DELETE') {
          objects.delete(key);
          response.writeHead(204);
        }
        response.end();
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  beforeEach(() => {
    objects.clear();
    requests.length = 0;
    failPut = false;
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('sends signed public uploads and removes the exact managed object', async () => {
    const storage = new S3StorageStrategy(config());
    const result = await storage.upload(file);
    expect(result.filename).toMatch(/^images\/[0-9a-f-]{36}\.png$/);
    expect(result.url).toBe(`${endpoint}/photos-1250000000/${result.filename}`);
    expect(objects.get(`/photos-1250000000/${result.filename}`)).toEqual(
      file.buffer,
    );
    expect(requests[0].headers.authorization).toContain('AWS4-HMAC-SHA256');
    expect(requests[0].headers.authorization).toContain(
      '/ap-guangzhou/s3/aws4_request',
    );
    expect(requests[0].headers['x-amz-security-token']).toBe('fixture-session');
    expect(requests[0].headers['content-type']).toBe('image/png');
    expect(requests[0].headers['x-amz-acl']).toBeUndefined();
    expect(requests[0].headers['x-amz-sdk-checksum-algorithm']).toBeUndefined();
    expect(requests[0].headers['x-amz-trailer']).toBeUndefined();
    await storage.remove(result.filename);
    await storage.remove(result.filename);
    expect(objects.size).toBe(0);
    expect(requests.map((request) => request.method)).toEqual([
      'PUT',
      'DELETE',
      'DELETE',
    ]);
  });

  it('round-trips staged private bytes and keeps the object off the public CDN', async () => {
    const storage = new S3StorageStrategy(
      config({ publicBaseUrl: 'https://cdn.example.test/media/' }),
    );
    const result = await storage.upload(file, true);
    expect(result.filename).toMatch(/^moderation-private\/[0-9a-f-]{36}\.png$/);
    expect(result.url).toBe(`${endpoint}/photos-1250000000/${result.filename}`);
    await expect(storage.read(result.filename)).resolves.toEqual(file.buffer);
    await storage.remove(result.filename);
    expect(objects.size).toBe(0);
  });

  it('uses a public URL prefix without changing the upload endpoint', async () => {
    const result = await new S3StorageStrategy(
      config({ publicBaseUrl: 'https://cdn.example.test/media/' }),
    ).upload(file);
    expect(result.url).toBe(
      `https://cdn.example.test/media/${result.filename}`,
    );
    expect(requests[0].key).toBe(`/photos-1250000000/${result.filename}`);
  });

  it('uses virtual-hosted addressing by default for COS', async () => {
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValueOnce({} as never);
    const result = await new S3StorageStrategy(
      config({
        endpoint: 'https://cos.ap-guangzhou.myqcloud.com',
        forcePathStyle: undefined,
      }),
    ).upload(file);
    expect(result.url).toBe(
      `https://photos-1250000000.cos.ap-guangzhou.myqcloud.com/${result.filename}`,
    );
    const client = send.mock.contexts[0] as S3Client;
    expect(client.config.forcePathStyle).toBe(false);
  });

  it('sends virtual-hosted requests through the SDK HTTP transport', async () => {
    const agent = new Agent();
    const port = (server.address() as AddressInfo).port;
    agent.createConnection = () =>
      createConnection({ host: '127.0.0.1', port });
    const original = S3Client.prototype.send;
    jest.spyOn(S3Client.prototype, 'send').mockImplementationOnce(function (
      this: S3Client,
      command,
    ) {
      const handler = this.config
        .requestHandler as typeof this.config.requestHandler & {
        updateHttpClientConfig(key: string, value: Agent): void;
      };
      handler.updateHttpClientConfig('httpAgent', agent);
      return original.call(this, command) as never;
    });
    const storage = new S3StorageStrategy(
      config({
        endpoint: `http://cos.ap-guangzhou.myqcloud.com:${port}`,
        forcePathStyle: false,
      }),
    );
    try {
      const result = await storage.upload(file);
      expect(requests[0].headers.host).toBe(
        `photos-1250000000.cos.ap-guangzhou.myqcloud.com:${port}`,
      );
      expect(requests[0].key).toBe(`/${result.filename}`);
      expect(objects.get(`/${result.filename}`)).toEqual(file.buffer);
      expect(result.url).toBe(
        `http://${requests[0].headers.host}/${result.filename}`,
      );
    } finally {
      storage.destroy();
      agent.destroy();
    }
  });

  it('reads and deletes identical keys in separate buckets using each record instance ID', async () => {
    const key = 'moderation-private/00000000-0000-4000-8000-000000000000.png';
    objects.set(`/aws-photos/${key}`, Buffer.from('aws-image'));
    objects.set(`/cos-photos/${key}`, Buffer.from('cos-image'));
    const values = {
      UPLOAD_DEFAULT_STORAGE_ID: 'cos-main',
      UPLOAD_STORAGE_INSTANCES: JSON.stringify({
        'aws-main': config({ bucket: 'aws-photos' }),
        'cos-main': config({ bucket: 'cos-photos' }),
      }),
    };
    const storage = new StorageService(new ConfigService(values));
    try {
      expect(storage.forId()).toBe(storage.forId('cos-main'));
      expect(storage.forId('aws-main')).not.toBe(storage.forId('cos-main'));
      await expect(storage.forId('aws-main').read(key)).resolves.toEqual(
        Buffer.from('aws-image'),
      );
      await expect(storage.forId('cos-main').read(key)).resolves.toEqual(
        Buffer.from('cos-image'),
      );
      await storage.forId('aws-main').remove(key);
      expect(objects.has(`/aws-photos/${key}`)).toBe(false);
      expect(objects.get(`/cos-photos/${key}`)).toEqual(
        Buffer.from('cos-image'),
      );
      const nextDefault = new StorageService(
        new ConfigService({ ...values, UPLOAD_DEFAULT_STORAGE_ID: 'aws-main' }),
      );
      try {
        await expect(nextDefault.forId('cos-main').read(key)).resolves.toEqual(
          Buffer.from('cos-image'),
        );
      } finally {
        nextDefault.onModuleDestroy();
      }
    } finally {
      storage.onModuleDestroy();
    }
  });

  it('sends an explicitly configured private object ACL', async () => {
    const storage = new S3StorageStrategy(
      config({ privateObjectAcl: 'private' }),
    );
    try {
      const result = await storage.upload(file, true);
      expect(requests[0].headers['x-amz-acl']).toBe('private');
      await storage.remove(result.filename);
    } finally {
      storage.destroy();
    }
  });

  it('propagates write and delete failures to the caller for rollback and retry', async () => {
    const storage = new S3StorageStrategy(config());
    failPut = true;
    await expect(storage.upload(file)).rejects.toThrow(
      'Failed to upload file to S3',
    );
    jest
      .spyOn(S3Client.prototype, 'send')
      .mockRejectedValueOnce(new Error('temporary network error') as never);
    await expect(
      storage.remove('images/00000000-0000-4000-8000-000000000000.png'),
    ).rejects.toThrow('temporary network error');
  });

  it.each([
    'other/object.png',
    'images/../../secret.png',
    'moderation-private/invalid.png',
  ])('rejects unmanaged keys before reading or deleting: %s', async (key) => {
    const storage = new S3StorageStrategy(config());
    await expect(storage.read(key)).rejects.toThrow('Invalid managed');
    await expect(storage.remove(key)).rejects.toThrow('Invalid managed');
    expect(requests).toHaveLength(0);
  });
});
