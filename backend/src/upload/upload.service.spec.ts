import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { UploadService } from './upload.service';

describe('UploadService', () => {
  const local = { upload: jest.fn() };
  const oss = { upload: jest.fn() };
  let service: UploadService;

  const imageFile = async (format: 'png' | 'jpeg' | 'gif' = 'png') => {
    const buffer = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#123456' },
    })
      .toFormat(format)
      .toBuffer();
    return {
      buffer,
      size: buffer.length,
      originalname: 'untrusted.html',
      mimetype: 'image/jpeg',
    } as Express.Multer.File;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    local.upload.mockResolvedValue({
      url: '/images/proof.png',
      filename: 'proof.png',
    });
    oss.upload.mockResolvedValue({
      url: 'https://images.example/proof.png',
      filename: 'proof.png',
    });
    service = new UploadService(
      { get: () => 'local' } as any,
      local as any,
      oss as any,
    );
  });

  it('decodes small images and derives MIME and extension from their contents', async () => {
    const result = await service.uploadFile(await imageFile());
    expect(result.code).toBe(200);
    const saved = local.upload.mock.calls[0][0];
    expect(saved.originalname).toBe('image.png');
    expect(saved.mimetype).toBe('image/png');
    expect((await sharp(saved.buffer).metadata()).format).toBe('png');
  });

  it.each([
    {
      large: false,
      orientation: 2,
      width: 64,
      height: 40,
      colors: ['110', '001', '010', '100'],
    },
    {
      large: false,
      orientation: 6,
      width: 40,
      height: 64,
      colors: ['100', '001', '010', '110'],
    },
    {
      large: true,
      orientation: 2,
      width: 1200,
      height: 2400,
      colors: ['110', '001', '010', '100'],
    },
    {
      large: true,
      orientation: 6,
      width: 1920,
      height: 960,
      colors: ['100', '001', '010', '110'],
    },
  ])(
    'preserves orientation $orientation before sanitizing (compressed: $large)',
    async ({ large, orientation, width, height, colors }) => {
      const sourceWidth = large ? 1200 : 64;
      const sourceHeight = large ? 2400 : 40;
      const pixels = Buffer.alloc(sourceWidth * sourceHeight * 3);
      // Four distinct quadrants make rotations and reflections observable.
      const quadrants = [
        [0, 0, 192],
        [192, 192, 0],
        [192, 0, 0],
        [0, 192, 0],
      ];
      let seed = 123456789;
      for (let y = 0; y < sourceHeight; y++) {
        for (let x = 0; x < sourceWidth; x++) {
          const quadrant =
            (y < sourceHeight / 2 ? 0 : 2) + (x < sourceWidth / 2 ? 0 : 1);
          for (let channel = 0; channel < 3; channel++) {
            seed ^= seed << 13;
            seed ^= seed >>> 17;
            seed ^= seed << 5;
            pixels[(y * sourceWidth + x) * 3 + channel] =
              quadrants[quadrant][channel] + (seed & 31);
          }
        }
      }
      const buffer = await sharp(pixels, {
        raw: { width: sourceWidth, height: sourceHeight, channels: 3 },
      })
        .jpeg({ quality: 100, chromaSubsampling: '4:4:4' })
        .withMetadata({ orientation })
        .toBuffer();
      expect(buffer.length > 1024 * 1024).toBe(large);

      await service.uploadFile({
        buffer,
        size: buffer.length,
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File);

      const saved = local.upload.mock.calls[0][0];
      const metadata = await sharp(saved.buffer).metadata();
      expect(metadata).toMatchObject({ width, height });
      expect(metadata.orientation).toBeUndefined();
      const output = await sharp(saved.buffer).raw().toBuffer();
      const actualColors = [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75],
      ].map(([x, y]) => {
        const index =
          (Math.floor(y * height) * width + Math.floor(x * width)) * 3;
        return [...output.subarray(index, index + 3)]
          .map((value) => (value > 128 ? '1' : '0'))
          .join('');
      });
      expect(actualColors).toEqual(colors);
    },
  );

  it.each([
    '<html><script>window.proof=true</script></html>',
    '%PDF-1.4',
    'not an image',
  ])('rejects non-image bytes before storage: %s', async (body) => {
    const file = {
      buffer: Buffer.from(body),
      size: body.length,
      originalname: 'proof.html',
      mimetype: 'image/png',
    } as Express.Multer.File;
    await expect(service.uploadFile(file)).rejects.toThrow(BadRequestException);
    expect(local.upload).not.toHaveBeenCalled();
  });

  it('rejects truncated image content', async () => {
    const file = await imageFile();
    file.buffer = file.buffer.subarray(0, 40);
    await expect(service.uploadFile(file)).rejects.toThrow(BadRequestException);
    expect(local.upload).not.toHaveBeenCalled();
  });

  it('does not store original bytes when image compression fails', async () => {
    const file = await imageFile('jpeg');
    file.size = 2 * 1024 * 1024;
    jest
      .spyOn(service as any, 'compressImage')
      .mockRejectedValue(new Error('invalid image'));
    await expect(service.uploadFile(file)).rejects.toThrow(BadRequestException);
    expect(local.upload).not.toHaveBeenCalled();
  });

  it('keeps GIF output in GIF format', async () => {
    const file = await imageFile('gif');
    file.size = 2 * 1024 * 1024;
    await service.uploadFile(file);
    const saved = local.upload.mock.calls[0][0];
    expect(saved.mimetype).toBe('image/gif');
    expect(saved.originalname).toBe('image.gif');
    expect((await sharp(saved.buffer).metadata()).format).toBe('gif');
  });

  it('preserves GIF animation frames and timing when sanitizing content', async () => {
    const buffer = await sharp(Buffer.from([255, 0, 0, 0, 255, 0]), {
      raw: { width: 1, height: 2, channels: 3, pageHeight: 1 },
    })
      .gif({ delay: [50, 100], loop: 0 })
      .toBuffer();
    await service.uploadFile({
      buffer,
      size: buffer.length,
      mimetype: 'image/gif',
      originalname: 'animation.gif',
    } as Express.Multer.File);
    const metadata = await sharp(local.upload.mock.calls[0][0].buffer, {
      animated: true,
    }).metadata();
    expect(metadata.pages).toBe(2);
    expect(metadata.delay).toEqual([50, 100]);
  });

  it('preserves WebP frames and timing through the second compression pass', async () => {
    const width = 1500;
    const pageHeight = 800;
    const pages = 3;
    const pixels = Buffer.alloc(width * pageHeight * pages * 3);
    let seed = 123456789;
    for (let index = 0; index < pixels.length; index++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      pixels[index] = seed & 255;
    }
    const buffer = await sharp(pixels, {
      raw: { width, height: pageHeight * pages, channels: 3, pageHeight },
    })
      .webp({ quality: 100, delay: [50, 100, 150], loop: 2 })
      .toBuffer();
    const firstPass = await sharp(buffer, { animated: true })
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    expect(firstPass.length).toBeGreaterThan(1024 * 1024);

    await service.uploadFile({
      buffer,
      size: buffer.length,
      mimetype: 'image/webp',
      originalname: 'animation.webp',
    } as Express.Multer.File);

    const saved = local.upload.mock.calls[0][0];
    const metadata = await sharp(saved.buffer, { animated: true }).metadata();
    expect(metadata.width).toBe(1280);
    expect(metadata.pages).toBe(pages);
    expect(metadata.delay).toEqual([50, 100, 150]);
    expect(metadata.loop).toBe(2);
    expect(saved.buffer.length).toBeLessThan(firstPass.length);
  }, 20000);

  it('applies the same image normalization before OSS storage', async () => {
    const svc = new UploadService(
      { get: () => 'oss' } as any,
      local as any,
      oss as any,
    );
    await svc.uploadFile(await imageFile());
    expect(oss.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        mimetype: 'image/png',
        originalname: 'image.png',
      }),
    );
    expect(local.upload).not.toHaveBeenCalled();
  });
});
