import { canonicalModerationImageUrl } from './moderation-image-url';
import { Inject, Optional } from '@nestjs/common';
import { ModerationSettingsService } from '@/content-moderation/moderation-settings.service';
import { ModerationAssetsService } from '@/content-moderation/moderation-assets.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  STORAGE_STRATEGY,
  type StorageStrategy,
} from './strategies/storage.strategy';
import { UploadResponseDto } from './dto/upload.dto';
import sharp from 'sharp';
import { PrismaService } from '@/prisma.service';
import { isCurrentStudent } from '@/auth/student-status';
import { CONTRIBUTION_IMAGE_TTL_MS } from './contribution-images';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  get storageType(): string {
    return this.configService.get<string>('UPLOAD_STORAGE_TYPE', 'local');
  }

  constructor(
    private configService: ConfigService,
    @Inject(STORAGE_STRATEGY) private readonly strategy: StorageStrategy,
    private readonly prisma: PrismaService,
    @Optional() private readonly moderationSettings?: ModerationSettingsService,
    @Optional() private readonly moderationAssets?: ModerationAssetsService,
  ) {}

  async uploadFile(
    file: Express.Multer.File,
    contributionUserId?: string,
    userId?: string,
  ): Promise<UploadResponseDto> {
    if (contributionUserId) {
      const verification = await this.prisma.studentVerification.findUnique({
        where: { userId: contributionUserId },
      });
      if (!isCurrentStudent(verification)) {
        throw new ForbiddenException({
          code: 'STUDENT_VERIFICATION_REQUIRED',
          message: '请先完成有效的在校学生认证',
        });
      }
    }
    let animated = false;
    try {
      const image = sharp(file.buffer, { animated: true }).autoOrient();
      const { format, pages } = await image.metadata();
      animated = (pages ?? 1) > 1;
      const extensions = { jpeg: 'jpg', png: 'png', gif: 'gif', webp: 'webp' };
      if (!format || !(format in extensions)) {
        throw new Error('Unsupported image format');
      }
      // Decode every image, including small files, and preserve all GIF frames.
      file.buffer =
        file.size > 1024 * 1024 && format !== 'gif'
          ? await this.compressImage(image)
          : await image.toBuffer();
      file.size = file.buffer.length;
      file.mimetype = `image/${format}`;
      file.originalname = `image.${extensions[format as keyof typeof extensions]}`;
    } catch {
      throw new BadRequestException('请上传完整的 JPEG、PNG、GIF 或 WebP 图片');
    }

    const policy = userId ? await this.moderationSettings?.policy() : undefined;
    const result =
      policy?.enabled && userId
        ? await this.moderationAssets!.stage(file, userId, animated)
        : await this.strategy.upload(file);
    if (contributionUserId) {
      try {
        await this.prisma.contributionImage.create({
          data: {
            userId: contributionUserId,
            url: canonicalModerationImageUrl(result.url),
            storageKey: result.filename,
            storageType: this.configService.get<string>(
              'UPLOAD_STORAGE_TYPE',
              'local',
            ),
            expiresAt: new Date(Date.now() + CONTRIBUTION_IMAGE_TTL_MS),
          },
        });
      } catch (error) {
        await this.strategy
          .remove(result.filename)
          .catch(() =>
            this.logger.error(
              'Unable to remove an unregistered contribution image',
            ),
          );
        throw error;
      }
    }
    return {
      code: 200,
      message: '上传成功',
      data: result,
    };
  }

  async removeContributionImage(
    storageType: string,
    storageKey: string,
  ): Promise<void> {
    if (
      storageType !==
      this.configService.get<string>('UPLOAD_STORAGE_TYPE', 'local')
    ) {
      throw new Error('Image storage configuration changed');
    }
    await this.strategy.remove(storageKey);
  }

  private async compressImage(image: sharp.Sharp): Promise<Buffer> {
    const metadata = await image.metadata();
    const format = metadata.format;

    // Step 1: Initial compression (Resize to 1920px, Quality 80)
    let pipeline = image.resize({ width: 1920, withoutEnlargement: true });

    if (format === 'jpeg' || format === 'jpg') {
      pipeline = pipeline.jpeg({ quality: 80 });
    } else if (format === 'png') {
      pipeline = pipeline.png({ quality: 80, palette: true });
    } else if (format === 'webp') {
      pipeline = pipeline.webp({ quality: 80 });
    }

    let outputBuffer = await pipeline.toBuffer();

    // Step 2: If still > 1MB, aggressive compression (Resize to 1280px, Quality 60)
    if (outputBuffer.length > 1024 * 1024) {
      const image2 = sharp(outputBuffer, { animated: true });
      const metadata2 = await image2.metadata();
      const format2 = metadata2.format;

      let pipeline2 = image2;
      if (metadata2.width && metadata2.width > 1280) {
        pipeline2 = pipeline2.resize({ width: 1280, withoutEnlargement: true });
      }

      if (format2 === 'jpeg' || format2 === 'jpg') {
        pipeline2 = pipeline2.jpeg({ quality: 60 });
      } else if (format2 === 'png') {
        pipeline2 = pipeline2.png({ quality: 60, palette: true });
      } else if (format2 === 'webp') {
        pipeline2 = pipeline2.webp({ quality: 60 });
      }

      outputBuffer = await pipeline2.toBuffer();
    }

    return outputBuffer;
  }
}
