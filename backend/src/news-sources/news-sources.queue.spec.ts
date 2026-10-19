import { NewsSourcesQueue } from './news-sources.queue';
import { WerssClient } from './werss.client';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

describe('optional WeRSS scheduling', () => {
  const queue = {
    upsertJobScheduler: jest.fn(),
    removeJobScheduler: jest.fn(),
  };
  beforeEach(() => jest.clearAllMocks());
  it.each([
    {},
    { WERSS_BASE_URL: 'http://werss:8001' },
    { WERSS_BASE_URL: 'http://werss:8001', WERSS_ACCESS_KEY: 'ak' },
  ])(
    'removes a previous scan schedule when connection configuration is incomplete: %j',
    async (values) => {
      const client = new WerssClient(new ConfigService(values));
      await new NewsSourcesQueue(
        queue as unknown as Queue,
        client,
      ).onModuleInit();
      expect(queue.upsertJobScheduler).not.toHaveBeenCalled();
      expect(queue.removeJobScheduler).toHaveBeenCalledWith('news-source-scan');
    },
  );
  it('enables the scan schedule when the integration is configured', async () => {
    const client = new WerssClient(
      new ConfigService({
        WERSS_BASE_URL: 'http://werss:8001',
        WERSS_ACCESS_KEY: 'ak',
        WERSS_SECRET_KEY: 'sk',
      }),
    );
    await new NewsSourcesQueue(
      queue as unknown as Queue,
      client,
    ).onModuleInit();
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'news-source-scan',
      { every: 60000 },
      expect.objectContaining({ name: 'scan' }),
    );
    expect(queue.removeJobScheduler).not.toHaveBeenCalled();
  });
});
