import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '@/prisma.service';
import { UserProfileController } from './user-profile.controller';
import { UserProfileService } from './user-profile.service';

describe('Contributor route authorization', () => {
  let app: INestApplication;
  const verification = { findUnique: jest.fn() };
  const service = {
    getMyUpload: jest.fn(async () => ({ code: 200, data: { id: 'upload' } })),
    updateMyUpload: jest.fn(async () => ({ code: 200 })),
    withdrawMyUpload: jest.fn(async () => ({ code: 200 })),
  };
  const jwt = new JwtService({ secret: 'contribution-route-test' });
  const token = () =>
    jwt.sign({ sub: 'author', type: 'user', tokenUse: 'access' });
  const body = {
    revision: 1,
    targetDishId: 'dish',
    changedFields: ['price'],
    price: 0,
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserProfileController],
      providers: [
        { provide: UserProfileService, useValue: service },
        {
          provide: PrismaService,
          useValue: { studentVerification: verification },
        },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            JWT_SECRET: 'contribution-route-test',
          }),
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    verification.findUnique.mockResolvedValue({
      status: 'VERIFIED',
      expiresAt: new Date(Date.now() + 60000),
    });
  });

  it('requires an active access token for reads and writes', async () => {
    await request(app.getHttpServer()).get('/user/uploads/upload').expect(401);
    const expired = jwt.sign(
      { sub: 'author', type: 'user', tokenUse: 'access' },
      { expiresIn: -1 },
    );
    await request(app.getHttpServer())
      .put('/user/uploads/upload')
      .set('Authorization', `Bearer ${expired}`)
      .send(body)
      .expect(401);
    expect(service.updateMyUpload).not.toHaveBeenCalled();
  });

  it('allows own-history reads after student verification expires but rejects edits and withdrawal', async () => {
    verification.findUnique.mockResolvedValue({
      status: 'VERIFIED',
      expiresAt: new Date(Date.now() - 1),
    });
    const authorization = `Bearer ${token()}`;
    await request(app.getHttpServer())
      .get('/user/uploads/upload')
      .set('Authorization', authorization)
      .expect(200);
    await request(app.getHttpServer())
      .put('/user/uploads/upload')
      .set('Authorization', authorization)
      .send(body)
      .expect(403);
    await request(app.getHttpServer())
      .post('/user/uploads/upload/withdraw')
      .set('Authorization', authorization)
      .send({ revision: 1 })
      .expect(403);
    expect(service.updateMyUpload).not.toHaveBeenCalled();
    expect(service.withdrawMyUpload).not.toHaveBeenCalled();
  });

  it('accepts partial correction fields and passes the authenticated owner to the service', async () => {
    await request(app.getHttpServer())
      .put('/user/uploads/upload')
      .set('Authorization', `Bearer ${token()}`)
      .send(body)
      .expect(200);
    expect(service.updateMyUpload).toHaveBeenCalledWith(
      'author',
      'upload',
      expect.objectContaining(body),
    );
  });

  it('rejects protected correction fields and missing revision at the route boundary', async () => {
    await request(app.getHttpServer())
      .put('/user/uploads/upload')
      .set('Authorization', `Bearer ${token()}`)
      .send({ ...body, changedFields: ['canteenId'], canteenId: 'another' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/user/uploads/upload/withdraw')
      .set('Authorization', `Bearer ${token()}`)
      .send({})
      .expect(400);
    expect(service.updateMyUpload).not.toHaveBeenCalled();
    expect(service.withdrawMyUpload).not.toHaveBeenCalled();
  });
});
