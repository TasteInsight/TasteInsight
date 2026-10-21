import sharp from 'sharp';
import { UploadService } from './upload.service';

describe('temporary contribution media', () => {
  const local = { upload: jest.fn(), remove: jest.fn() };
  const prisma = {
    studentVerification: { findUnique: jest.fn() },
    contributionImage: { create: jest.fn() },
  };
  let service: UploadService;
  beforeEach(() => {
    jest.resetAllMocks();
    local.upload.mockResolvedValue({
      url: 'https://media.test/a.jpg',
      filename: 'a.jpg',
    });
    local.remove.mockResolvedValue(undefined);
    prisma.studentVerification.findUnique.mockResolvedValue({
      status: 'VERIFIED',
      expiresAt: new Date(Date.now() + 86400000),
    });
    prisma.contributionImage.create.mockResolvedValue({ id: 'image' });
    service = new UploadService(
      { type: 'local', forType: () => local } as any,
      prisma as any,
    );
  });
  async function file() {
    const buffer = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#fff' },
    })
      .jpeg()
      .toBuffer();
    return {
      buffer,
      size: buffer.length,
      originalname: 'a.jpg',
      mimetype: 'image/jpeg',
    };
  }
  it('records only explicitly scoped contribution media with a bounded expiry', async () => {
    const now = Date.now();
    await (service as any).uploadFile(await file(), 'student');
    expect(prisma.contributionImage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'student',
        url: 'https://media.test/a.jpg',
        storageKey: 'a.jpg',
        storageType: 'local',
        expiresAt: expect.any(Date),
      }),
    });
    expect(
      prisma.contributionImage.create.mock.calls[0][0].data.expiresAt.getTime(),
    ).toBeGreaterThan(now);
  });
  it('does not enroll legacy image uses in automatic cleanup', async () => {
    await service.uploadFile((await file()) as any);
    expect(prisma.contributionImage.create).not.toHaveBeenCalled();
  });
  it('rejects unverified contributors before storing bytes', async () => {
    prisma.studentVerification.findUnique.mockResolvedValue(null);
    await expect(
      (service as any).uploadFile(await file(), 'visitor'),
    ).rejects.toMatchObject({ status: 403 });
    expect(local.upload).not.toHaveBeenCalled();
  });
  it('removes only the newly allocated file when registering its metadata fails', async () => {
    prisma.contributionImage.create.mockRejectedValue(
      new Error('database unavailable'),
    );
    await expect(
      (service as any).uploadFile(await file(), 'student'),
    ).rejects.toThrow('database unavailable');
    expect(local.remove).toHaveBeenCalledWith('a.jpg');
  });
});
