import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageStrategy } from './strategies/storage.strategy';
import { LocalStorageStrategy } from './strategies/local-storage.strategy';
import { OssStorageStrategy } from './strategies/oss-storage.strategy';
import { UploadResponseDto } from './dto/upload.dto';

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
    const result = await this.strategy.upload(file);
    return {
      code: 200,
      message: '上传成功',
      data: result,
    };
  }
}
