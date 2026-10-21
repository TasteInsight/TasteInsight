import { ConfigService } from '@nestjs/config';
import OSS from 'ali-oss';
import { OssStorageStrategy } from './oss-storage.strategy';

describe('OSS SDK contract', () => {
  const file = {
    buffer: Buffer.from('normalized-image'),
    originalname: 'image.png',
  } as Express.Multer.File;
  afterEach(() => jest.restoreAllMocks());
  it('reads historical OSS objects while new uploads use another provider', async () => {
    const get = jest
      .spyOn(OSS.prototype, 'get')
      .mockResolvedValue({ content: file.buffer } as never);
    const storage = new OssStorageStrategy(
      new ConfigService({
        UPLOAD_STORAGE_TYPE: 'local',
        OSS_REGION: 'oss-cn-shanghai',
        OSS_ACCESS_KEY_ID: 'fixture-key',
        OSS_ACCESS_KEY_SECRET: 'fixture-secret',
        OSS_BUCKET: 'photos',
      }),
    );
    const key = 'moderation-private/00000000-0000-4000-8000-000000000000.png';
    await expect(storage.read(key)).resolves.toEqual(file.buffer);
    expect(get).toHaveBeenCalledWith(key);
  });

  it('reports missing credentials when the historical OSS backend is read', async () => {
    const get = jest.spyOn(OSS.prototype, 'get');
    const storage = new OssStorageStrategy(
      new ConfigService({ UPLOAD_STORAGE_TYPE: 'local' }),
    );
    await expect(
      storage.read(
        'moderation-private/00000000-0000-4000-8000-000000000000.png',
      ),
    ).rejects.toThrow('OSS_REGION');
    expect(get).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'preserves upload, private read and deletion (private: %s)',
    async (privateFile) => {
      const prefix = privateFile ? 'moderation-private' : 'images';
      const putResponse = (key: string) =>
        Promise.resolve({
          url: `https://photos.oss-cn-shanghai.aliyuncs.com/${key}`,
        });
      const put = jest
        .spyOn(OSS.prototype, 'put')
        .mockImplementation(putResponse as never);
      jest
        .spyOn(OSS.prototype, 'get')
        .mockResolvedValue({ content: file.buffer } as never);
      const remove = jest
        .spyOn(OSS.prototype, 'delete')
        .mockResolvedValue({} as never);
      const storage = new OssStorageStrategy(
        new ConfigService({
          UPLOAD_STORAGE_TYPE: 'oss',
          OSS_REGION: 'oss-cn-shanghai',
          OSS_ACCESS_KEY_ID: 'fixture-key',
          OSS_ACCESS_KEY_SECRET: 'fixture-secret',
          OSS_BUCKET: 'photos',
          OSS_CUSTOM_DOMAIN: 'https://images.example.test/media/',
        }),
      );
      const result = await storage.upload(file, privateFile);
      expect(result.filename).toMatch(
        new RegExp(`^${prefix}/[0-9a-f-]{36}\\.png$`),
      );
      expect(result.url).toBe(
        `https://images.example.test/media/${result.filename}`,
      );
      expect(put).toHaveBeenCalledWith(
        result.filename,
        file.buffer,
        privateFile
          ? { headers: { 'x-oss-object-acl': 'private' } }
          : undefined,
      );
      if (privateFile)
        await expect(storage.read(result.filename)).resolves.toEqual(
          file.buffer,
        );
      await storage.remove(result.filename);
      expect(remove).toHaveBeenCalledWith(result.filename);
    },
  );
});
