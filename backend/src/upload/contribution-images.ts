import { canonicalModerationImageUrls } from './moderation-image-url';
import { ForbiddenException, GoneException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const CONTRIBUTION_IMAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Bind managed images in the same transaction as their contribution. */
export async function claimContributionImages(
  tx: Prisma.TransactionClient,
  userId: string,
  urls: string[],
  uploadId: string,
  targetImages: string[] = [],
): Promise<void> {
  const existing = new Set(canonicalModerationImageUrls(targetImages));
  const added = canonicalModerationImageUrls(urls).filter(
    (url) => !existing.has(url),
  );
  if (!added.length) return;
  const managed = await tx.contributionImage.findMany({
    where: { url: { in: added } },
    orderBy: { id: 'asc' },
  });
  // Existing clients and catalog images predate this asset ledger.
  for (const image of managed) {
    if (image.userId !== userId)
      throw new ForbiddenException('不能使用其他用户尚未提交的图片');
    const claimed = await tx.contributionImage.updateMany({
      where: {
        id: image.id,
        userId,
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      data: { uploadId, expiresAt: null },
    });
    if (!claimed.count) throw new GoneException('图片已过期，请重新上传后提交');
  }
}
