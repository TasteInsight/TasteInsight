import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageStrategy } from './strategies/storage.strategy';
import { LocalStorageStrategy } from './strategies/local-storage.strategy';
import { OssStorageStrategy } from './strategies/oss-storage.strategy';
import { UploadResponseDto } from './dto/upload.dto';
import sharp from 'sharp';

@Injectable()
export class UploadService {
  private strategy: StorageStrategy;

  constructor(
    private configService: ConfigService,
    private localStorageStrategy: LocalStorageStrategy,
    private ossStorageStrategy: OssStorageStrategy,
  ) {
    const storageType = this.configService.get<string>(
      'UPLOAD_STORAGE_TYPE',
      'local',
    );

    if (storageType === 'oss') {
      this.strategy = this.ossStorageStrategy;
    } else {
      this.strategy = this.localStorageStrategy;
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<UploadResponseDto> {
    try {
      const image = sharp(file.buffer, { animated: true }).autoOrient();
      const { format } = await image.metadata();
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

    const result = await this.strategy.upload(file);
    return {
      code: 200,
      message: '上传成功',
      data: result,
    };
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
