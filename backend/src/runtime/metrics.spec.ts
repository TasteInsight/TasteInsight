import {
  Controller,
  Get,
  INestApplication,
  Module,
  Param,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createMetrics } from './metrics';

@Controller('items')
class ItemsController {
  @Get(':id') get(@Param('id') id: string) {
    return { id };
  }
}
@Module({ controllers: [ItemsController] })
class TestModule {}

describe('Internal metrics', () => {
  let app: INestApplication;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();
    app = module.createNestApplication();
    const metrics = createMetrics();
    app.use(metrics.middleware);
    app.getHttpAdapter().get('/metrics', metrics.handle);
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });
  it('uses route templates and omits secrets, ids and unmatched URLs', async () => {
    await request(app.getHttpServer())
      .get('/items/private-id?token=secret')
      .expect(200);
    await request(app.getHttpServer()).get('/unmatched-private-id').expect(404);
    const result = await request(app.getHttpServer())
      .get('/metrics')
      .expect(200);
    expect(result.text).toContain('route="/items/:id"');
    expect(result.text).toContain('route="unmatched"');
    expect(result.text).not.toMatch(/private-id|secret|route="\/metrics"/);
    expect(result.text).toContain('tasteinsight_http_duration_seconds_bucket');
  });
  it('exports queue counts with the actual queue names', async () => {
    const metrics = createMetrics([
      {
        name: 'dish-sync',
        getJobCounts: jest.fn().mockResolvedValue({ waiting: 3, failed: 1 }),
      },
    ]);
    const result = await metrics.registry.metrics();
    expect(result).toContain(
      'tasteinsight_queue_jobs{queue="dish-sync",state="waiting"} 3',
    );
  });
  it('fails the scrape on queue collection failure instead of returning old counts', async () => {
    const metrics = createMetrics([
      {
        name: 'dish-sync',
        getJobCounts: jest.fn().mockRejectedValue(new Error('redis secret')),
      },
    ]);
    await expect(metrics.registry.metrics()).rejects.toThrow('redis secret');
  });
});
