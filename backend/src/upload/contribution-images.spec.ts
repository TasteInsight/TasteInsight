import { claimContributionImages } from './contribution-images';
import { ContributionImageCleanup } from './contribution-image-cleanup.service';

describe('contribution asset ownership and cleanup', () => {
  const model = { findMany: jest.fn(), updateMany: jest.fn() };
  const tx = { contributionImage: model } as any;
  beforeEach(() => jest.resetAllMocks());

  it('binds owned managed images while preserving legacy URLs', async () => {
    model.findMany.mockResolvedValue([{ id: 'managed', userId: 'u' }]);
    model.updateMany.mockResolvedValue({ count: 1 });
    await claimContributionImages(tx, 'u', ['legacy', 'managed-url'], 'upload');
    expect(model.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { uploadId: 'upload', expiresAt: null },
      }),
    );
  });
  it('rejects another contributor image', async () => {
    model.findMany.mockResolvedValue([{ id: 'managed', userId: 'other' }]);
    await expect(
      claimContributionImages(tx, 'u', ['managed'], 'upload'),
    ).rejects.toMatchObject({ status: 403 });
    expect(model.updateMany).not.toHaveBeenCalled();
  });
  it('rejects an expired image even if it expired during the binding race', async () => {
    model.findMany.mockResolvedValue([{ id: 'managed', userId: 'u' }]);
    model.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      claimContributionImages(tx, 'u', ['managed'], 'upload'),
    ).rejects.toMatchObject({ status: 410 });
  });
  it('does not delete bytes if a submission bound the image before cleanup', async () => {
    model.findMany.mockResolvedValue([
      { id: 'managed', storageId: 'local', storageKey: 'owned.jpg' },
    ]);
    model.updateMany.mockResolvedValue({ count: 0 });
    const removeContributionImage = jest.fn();
    const cleanup = new ContributionImageCleanup(
      tx,
      { removeContributionImage } as any,
      {} as any,
    );
    await cleanup.tick();
    expect(removeContributionImage).not.toHaveBeenCalled();
  });
  it('retains an expired tombstone and retries failed file deletion', async () => {
    model.findMany.mockResolvedValue([
      { id: 'managed', storageId: 'local', storageKey: 'owned.jpg' },
    ]);
    model.updateMany.mockResolvedValue({ count: 1 });
    const removeContributionImage = jest
      .fn()
      .mockRejectedValueOnce(new Error('disk busy'))
      .mockResolvedValue(undefined);
    const cleanup = new ContributionImageCleanup(
      tx,
      { removeContributionImage } as any,
      {} as any,
    );
    await cleanup.tick();
    expect(model.updateMany).toHaveBeenCalledTimes(2);
    expect(model.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { expiresAt: expect.any(Date) } }),
    );
    await cleanup.tick(new Date(Date.now() + 300001));
    expect(removeContributionImage).toHaveBeenCalledTimes(2);
    expect(model.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { expiresAt: null } }),
    );
  });

  it('scans configured instance IDs so removed instances cannot starve active images', async () => {
    model.findMany.mockResolvedValue([]);
    const cleanup = new ContributionImageCleanup(
      tx,
      { storageIds: ['oss', 'cos-main'] } as any,
      {} as any,
    );
    await cleanup.tick();
    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          storageId: { in: ['oss', 'cos-main'] },
        }),
      }),
    );
  });
});
