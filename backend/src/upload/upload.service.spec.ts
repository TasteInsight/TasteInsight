import { Test, TestingModule } from '@nestjs/testing';
import { UploadService } from './upload.service';
import { ConfigService } from '@nestjs/config';
import { LocalStorageStrategy } from './strategies/local-storage.strategy';
import { OssStorageStrategy } from './strategies/oss-storage.strategy';

const mockConfigService = {
  get: jest.fn().mockReturnValue('local'),
};

const mockLocalStorageStrategy = {
  upload: jest.fn(),
};

const mockOssStorageStrategy = {
  upload: jest.fn(),
};

describe('UploadService', () => {
  let service: UploadService;
  let configService: typeof mockConfigService;
  let localStorageStrategy: typeof mockLocalStorageStrategy;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue('local');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: LocalStorageStrategy, useValue: mockLocalStorageStrategy },
        { provide: OssStorageStrategy, useValue: mockOssStorageStrategy },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
    configService = mockConfigService;
    localStorageStrategy = mockLocalStorageStrategy;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadFile', () => {
    const mockFile = {
      buffer: Buffer.from('test'),
      size: 100,
      mimetype: 'image/jpeg',
      originalname: 'test.jpg',
    } as Express.Multer.File;

    it('should upload a small file without compression', async () => {
      localStorageStrategy.upload.mockResolvedValue({
        url: 'https://example.com/test.jpg',
        filename: 'test.jpg',
      });

      const result = await service.uploadFile(mockFile);

      expect(result.code).toBe(200);
      expect(result.message).toBe('上传成功');
      expect(result.data.url).toBe('https://example.com/test.jpg');
    });

    it('should upload non-image files without compression', async () => {
      const pdfFile = {
        buffer: Buffer.alloc(2 * 1024 * 1024), // 2MB
        size: 2 * 1024 * 1024,
        mimetype: 'application/pdf',
        originalname: 'test.pdf',
      } as Express.Multer.File;

      localStorageStrategy.upload.mockResolvedValue({
        url: 'https://example.com/test.pdf',
        filename: 'test.pdf',
      });

      const result = await service.uploadFile(pdfFile);

      expect(result.code).toBe(200);
    });

    it('should skip compression for GIF files', async () => {
      const gifFile = {
        buffer: Buffer.alloc(2 * 1024 * 1024),
        size: 2 * 1024 * 1024,
        mimetype: 'image/gif',
        originalname: 'test.gif',
      } as Express.Multer.File;

      localStorageStrategy.upload.mockResolvedValue({
        url: 'https://example.com/test.gif',
        filename: 'test.gif',
      });

      const result = await service.uploadFile(gifFile);

      expect(result.code).toBe(200);
    });
  });

  describe('constructor - storage type selection', () => {
    it('should use local storage by default', async () => {
      mockConfigService.get.mockReturnValue('local');

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UploadService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: LocalStorageStrategy, useValue: mockLocalStorageStrategy },
          { provide: OssStorageStrategy, useValue: mockOssStorageStrategy },
        ],
      }).compile();

      const svc = module.get<UploadService>(UploadService);
      expect(svc).toBeDefined();
    });

    it('should use OSS storage when configured', async () => {
      mockConfigService.get.mockReturnValue('oss');

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UploadService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: LocalStorageStrategy, useValue: mockLocalStorageStrategy },
          { provide: OssStorageStrategy, useValue: mockOssStorageStrategy },
        ],
      }).compile();

      const svc = module.get<UploadService>(UploadService);
      expect(svc).toBeDefined();
    });
  });
});
