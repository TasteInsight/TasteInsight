import { S3StorageConfiguration } from '../storage.config';
import { InternalServerErrorException, Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { StorageStrategy, UploadResult } from './storage.strategy';

export class S3StorageStrategy implements StorageStrategy {
  private client?: S3Client;
  private objectBaseUrl?: string;
  private readonly logger = new Logger(S3StorageStrategy.name);

  constructor(private readonly config: S3StorageConfiguration) {}

  private getClient(): S3Client {
    if (this.client) return this.client;
    const { endpoint, region, forcePathStyle = false } = this.config;
    const client = new S3Client({
      endpoint,
      region,
      forcePathStyle,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
        sessionToken: this.config.sessionToken,
      },
      // Optional AWS checksum extensions are not implemented by every S3 service.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
    this.objectBaseUrl = client.config
      .endpointProvider({
        Bucket: this.config.bucket,
        Region: region,
        Endpoint: endpoint,
        ForcePathStyle: forcePathStyle,
        UseFIPS: false,
        UseDualStack: false,
        Accelerate: false,
      })
      .url.href.replace(/\/$/, '');
    this.client = client;
    return client;
  }

  async upload(
    file: Express.Multer.File,
    privateFile = false,
  ): Promise<UploadResult> {
    const filename = `${privateFile ? 'moderation-private' : 'images'}/${randomUUID()}${path.extname(file.originalname)}`;
    const client = this.getClient();
    const publicBaseUrl = this.config.publicBaseUrl;
    const baseUrl = (
      !privateFile && publicBaseUrl ? publicBaseUrl : this.objectBaseUrl
    )!.replace(/\/$/, '');
    try {
      // Bucket policy grants anonymous reads only to images/*; staged objects remain private.
      await client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: filename,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: privateFile ? this.config.privateObjectAcl : undefined,
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
    const client = this.getClient();
    const result = await client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: storageKey }),
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
    const client = this.getClient();
    await client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: storageKey }),
    );
  }

  destroy(): void {
    this.client?.destroy();
  }
}
