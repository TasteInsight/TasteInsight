import { ConfigService } from '@nestjs/config';
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
  const config = (extra: Record<string, unknown> = {}) =>
    new ConfigService({
      UPLOAD_STORAGE_TYPE: 's3',
      S3_ENDPOINT: endpoint,
      S3_REGION: 'ap-guangzhou',
      S3_BUCKET: 'photos-1250000000',
      S3_ACCESS_KEY_ID: 'fixture-key',
      S3_SECRET_ACCESS_KEY: 'fixture-secret',
      S3_SESSION_TOKEN: 'fixture-session',
      S3_FORCE_PATH_STYLE: true,
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
      config({ S3_PUBLIC_BASE_URL: 'https://cdn.example.test/media/' }),
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
      config({ S3_PUBLIC_BASE_URL: 'https://cdn.example.test/media/' }),
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
        S3_ENDPOINT: 'https://cos.ap-guangzhou.myqcloud.com',
        S3_FORCE_PATH_STYLE: undefined,
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
        S3_ENDPOINT: `http://cos.ap-guangzhou.myqcloud.com:${port}`,
        S3_FORCE_PATH_STYLE: false,
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
      storage.onModuleDestroy();
      agent.destroy();
    }
  });

  it('reads historical S3 bytes when another provider handles new uploads', async () => {
    const original = new S3StorageStrategy(config());
    const result = await original.upload(file, true);
    const historical = new S3StorageStrategy(
      config({ UPLOAD_STORAGE_TYPE: 'local', S3_FORCE_PATH_STYLE: 'true' }),
    );
    try {
      await expect(historical.read(result.filename)).resolves.toEqual(
        file.buffer,
      );
      await historical.remove(result.filename);
      expect(objects.size).toBe(0);
    } finally {
      original.onModuleDestroy();
      historical.onModuleDestroy();
    }
  });

  it('reports missing credentials when a historical S3 backend is actually read', async () => {
    const storage = new S3StorageStrategy(
      config({ UPLOAD_STORAGE_TYPE: 'local', S3_ACCESS_KEY_ID: undefined }),
    );
    await expect(
      storage.read(
        'moderation-private/00000000-0000-4000-8000-000000000000.png',
      ),
    ).rejects.toThrow('S3_ACCESS_KEY_ID');
    expect(requests).toHaveLength(0);
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
