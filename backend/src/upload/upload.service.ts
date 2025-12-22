import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageStrategy } from './strategies/storage.strategy';
import { LocalStorageStrategy } from './strategies/local-storage.strategy';
import { OssStorageStrategy } from './strategies/oss-storage.strategy';
import { UploadResponseDto } from './dto/upload.dto';
import sharp from 'sharp';

@Injectable()
export class UploadService {
  private strategy: StorageStrategy;
  private readonly logger = new Logger(UploadService.name);

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
    // Check if file size is greater than 1MB (1024 * 1024 bytes)
    const ONE_MB = 1024 * 1024;
    if (file.size > ONE_MB) {
      this.logger.log(`File size ${file.size} exceeds 1MB, compressing...`);
      try {
        const compressedBuffer = await this.compressImage(file.buffer);

        // Update file object with compressed data
        file.buffer = compressedBuffer;
        file.size = compressedBuffer.length;

        this.logger.log(`File compressed to ${file.size} bytes`);
      } catch (error) {
        this.logger.error('Image compression failed', error);
      }
    }

    const result = await this.strategy.upload(file);
    return {
      code: 200,
      message: '上传成功',
      data: result,
    };
  }

  private async compressImage(buffer: Buffer): Promise<Buffer> {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const format = metadata.format;

    // Step 1: Initial compression (Resize to 1920px, Quality 80)
    let pipeline = image;
    if (metadata.width && metadata.width > 1920) {
      pipeline = pipeline.resize({ width: 1920, withoutEnlargement: true });
    }

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
      const image2 = sharp(outputBuffer);
      const metadata2 = await image2.metadata();

      let pipeline2 = image2;
      if (metadata2.width && metadata2.width > 1280) {
        pipeline2 = pipeline2.resize({ width: 1280, withoutEnlargement: true });
      }

      if (format === 'jpeg' || format === 'jpg') {
        pipeline2 = pipeline2.jpeg({ quality: 60 });
      } else if (format === 'png') {
        pipeline2 = pipeline2.png({ quality: 60, palette: true });
      } else if (format === 'webp') {
        pipeline2 = pipeline2.webp({ quality: 60 });
      }

      outputBuffer = await pipeline2.toBuffer();
    }

    return outputBuffer;
  }
}
