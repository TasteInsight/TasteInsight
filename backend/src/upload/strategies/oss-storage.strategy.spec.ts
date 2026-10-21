import { ConfigService } from '@nestjs/config';
import OSS from 'ali-oss';
import { OssStorageStrategy } from './oss-storage.strategy';

describe('OSS SDK contract', () => {
  const file = {
    buffer: Buffer.from('normalized-image'),
    originalname: 'image.png',
  } as Express.Multer.File;
  afterEach(() => jest.restoreAllMocks());
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
