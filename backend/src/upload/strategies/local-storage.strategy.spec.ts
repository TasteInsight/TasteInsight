import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { LocalStorageStrategy } from './local-storage.strategy';

describe('local storage bytes', () => {
  let directory: string;
  let storage: LocalStorageStrategy;
  const file = {
    buffer: Buffer.from('normalized-image'),
    originalname: 'image.png',
  } as Express.Multer.File;
  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'tasteinsight-storage-'));
    storage = new LocalStorageStrategy({
      type: 'local',
      path: directory,
      publicBaseUrl: 'https://images.example.test/media/',
    });
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  it('writes public bytes and deletes the exact file', async () => {
    const result = await storage.upload(file);
    expect(result.url).toBe(
      `https://images.example.test/media/${result.filename}`,
    );
    await expect(
      readFile(path.join(directory, result.filename)),
    ).resolves.toEqual(file.buffer);
    await storage.remove(result.filename);
    await storage.remove(result.filename);
    await expect(
      readFile(path.join(directory, result.filename)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('keeps staged bytes in the protected local directory', async () => {
    const result = await storage.upload(file, true);
    expect(result.filename).toMatch(/^\.moderation\//);
    await expect(storage.read(result.filename)).resolves.toEqual(file.buffer);
    await storage.remove(result.filename);
    await expect(storage.read(result.filename)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
