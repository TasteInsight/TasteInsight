import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

describe('UploadController (e2e)', () => {
  let app: NestExpressApplication;
  let accessToken: string;
  let uploadsDir: string;
  let testImage: Buffer;

  beforeAll(async () => {
    // The HTTP adapter must exist when ServeStaticModule chooses its loader.
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: false,
    });

    uploadsDir = path.resolve(
      process.cwd(),
      app.get(ConfigService).get<string>('UPLOAD_LOCAL_PATH', './uploads'),
    );

    await app.init();

    testImage = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#123456' },
    })
      .jpeg()
      .toBuffer();

    // Login to get access token
    const adminUsername = process.env.INITIAL_ADMIN_USERNAME || 'testadmin';
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'password123';
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ username: adminUsername, password: adminPassword });

    accessToken = loginResponse.body.data.token.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/upload/image (POST)', () => {
    it('should upload an image successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/upload/image')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', testImage, 'test-image.jpg');

      if (response.status !== 201) {
        console.log('Upload failed:', response.body);
      }
      expect(response.status).toBe(201);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('上传成功');
      expect(response.body.data).toHaveProperty('url');
      expect(response.body.data).toHaveProperty('filename');
      expect(response.body.data.url).toMatch(/\/images\/.*\.jpg$/);

      // Verify file exists on disk (assuming local storage)
      const fileName = path.basename(response.body.data.url);
      const uploadPath = path.join(uploadsDir, fileName);
      expect(fs.existsSync(uploadPath)).toBe(true);

      // Clean up uploaded file
      if (fs.existsSync(uploadPath)) {
        fs.unlinkSync(uploadPath);
      }
    });

    it('should fail if no file is uploaded', async () => {
      await request(app.getHttpServer())
        .post('/upload/image')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should fail if file type is invalid', async () => {
      await request(app.getHttpServer())
        .post('/upload/image')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from('This is a text file'), 'test-file.txt')
        .expect(400);
    });

    it('should fail if not authenticated', async () => {
      await request(app.getHttpServer())
        .post('/upload/image')
        .attach('file', testImage, 'test-image.jpg')
        .expect(401);
    });

    it('should be able to access the uploaded file via HTTP', async () => {
      // First upload
      const uploadResponse = await request(app.getHttpServer())
        .post('/upload/image')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', testImage, 'test-image.jpg')
        .expect(201);

      const fileUrl = uploadResponse.body.data.url;
      const relativeUrl = new URL(fileUrl, 'http://localhost').pathname;

      const fileName = path.basename(fileUrl);
      const uploadPath = path.join(uploadsDir, fileName);

      // Then try to access it
      await request(app.getHttpServer())
        .get(relativeUrl)
        .expect(200)
        .expect('Content-Type', /image\/jpeg/)
        .expect('X-Content-Type-Options', 'nosniff')
        .expect('Content-Security-Policy', "default-src 'none'; sandbox");

      // Clean up
      if (fs.existsSync(uploadPath)) {
        fs.unlinkSync(uploadPath);
      }
    });

    it('should compress large image > 1MB', async () => {
      // Generate a large image > 1MB using random noise
      const width = 1000;
      const height = 1000;
      const channels = 3;
      const size = width * height * channels;
      const randomBuffer = Buffer.alloc(size);
      // Fill with random noise to ensure poor compression initially and large size
      for (let i = 0; i < size; i++) {
        randomBuffer[i] = Math.floor(Math.random() * 256);
      }

      const largeImageBuffer = await sharp(randomBuffer, {
        raw: { width, height, channels },
      })
        .jpeg({ quality: 100 })
        .toBuffer();

      const response = await request(app.getHttpServer())
        .post('/upload/image')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', largeImageBuffer, 'large-noise.jpg')
        .expect(201);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.url).toBeDefined();

      // Check saved file size
      const savedFilePath = path.join(
        uploadsDir,
        path.basename(response.body.data.url),
      );

      expect(fs.existsSync(savedFilePath)).toBe(true);

      const stats = fs.statSync(savedFilePath);
      // Should be compressed (Quality 100 -> 80)
      expect(stats.size).toBeLessThan(largeImageBuffer.length);

      // Clean up
      if (fs.existsSync(savedFilePath)) {
        fs.unlinkSync(savedFilePath);
      }
    });
  });
});
