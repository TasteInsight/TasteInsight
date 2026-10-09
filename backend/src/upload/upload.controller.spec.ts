import { BadRequestException } from '@nestjs/common';
import { UploadController } from './upload.controller';

describe('UploadController input limits', () => {
  it('rejects oversized input before decoding or storing it', async () => {
    const service = { uploadFile: jest.fn() };
    const controller = new UploadController(
      service as any,
      { get: () => 100 } as any,
    );
    const file = {
      buffer: Buffer.alloc(101),
      size: 101,
      originalname: 'proof.png',
      mimetype: 'image/png',
    } as Express.Multer.File;
    await expect(controller.uploadImage(file)).rejects.toThrow(
      BadRequestException,
    );
    expect(service.uploadFile).not.toHaveBeenCalled();
  });
});
