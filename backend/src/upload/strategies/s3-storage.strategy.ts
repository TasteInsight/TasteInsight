import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { StorageStrategy, UploadResult } from './storage.strategy';

@Injectable()
export class S3StorageStrategy implements StorageStrategy, OnModuleDestroy {
  private readonly client?: S3Client;
  private readonly bucket?: string;
  private readonly objectBaseUrl?: string;
  private readonly logger = new Logger(S3StorageStrategy.name);

  constructor(private readonly config: ConfigService) {
    if (config.get<string>('UPLOAD_STORAGE_TYPE') !== 's3') return;
    const endpoint = config.getOrThrow<string>('S3_ENDPOINT');
    const region = config.getOrThrow<string>('S3_REGION');
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    const forcePathStyle = config.get<boolean>('S3_FORCE_PATH_STYLE', false);
    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle,
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_ACCESS_KEY'),
        sessionToken: config.get<string>('S3_SESSION_TOKEN') || undefined,
      },
      // Optional AWS checksum extensions are not implemented by every S3 service.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
    this.objectBaseUrl = this.client.config
      .endpointProvider({
        Bucket: this.bucket,
        Region: region,
        Endpoint: endpoint,
        ForcePathStyle: forcePathStyle,
        UseFIPS: false,
        UseDualStack: false,
        Accelerate: false,
      })
      .url.href.replace(/\/$/, '');
  }

  async upload(
    file: Express.Multer.File,
    privateFile = false,
  ): Promise<UploadResult> {
    const filename = `${privateFile ? 'moderation-private' : 'images'}/${randomUUID()}${path.extname(file.originalname)}`;
    const publicBaseUrl = this.config.get<string>('S3_PUBLIC_BASE_URL');
    const baseUrl = (
      !privateFile && publicBaseUrl ? publicBaseUrl : this.objectBaseUrl
    )!.replace(/\/$/, '');
    try {
      // Bucket policy grants anonymous reads only to images/*; staged objects remain private.
      await this.client!.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: filename,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      return { filename, url: `${baseUrl}/${filename}` };
    } catch (error) {
      this.logger.error('S3 upload failed', error);
      throw new InternalServerErrorException('Failed to upload file to S3');
    }
  }

  async read(storageKey: string): Promise<Buffer> {
    if (
      !/^moderation-private\/[0-9a-f-]{36}\.(jpg|png|gif|webp)$/.test(
        storageKey,
      )
    ) {
      throw new Error('Invalid managed image key');
    }
    const result = await this.client!.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
    return Buffer.from(await result.Body!.transformToByteArray());
  }

  async remove(storageKey: string): Promise<void> {
    if (
      !/^(?:images|moderation-private)\/[0-9a-f-]{36}\.(jpg|png|gif|webp)$/.test(
        storageKey,
      )
    ) {
      throw new Error('Invalid managed S3 image key');
    }
    await this.client!.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
  }

  onModuleDestroy(): void {
    this.client?.destroy();
  }
}
