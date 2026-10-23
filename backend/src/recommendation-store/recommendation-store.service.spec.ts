import { ConfigService } from '@nestjs/config';
import {
  indexTable,
  RecommendationStoreService,
} from './recommendation-store.service';

describe('RecommendationStoreService boundaries', () => {
  it('stays disabled without an explicit recommendation URL', async () => {
    const store = new RecommendationStoreService(new ConfigService({}));
    expect(store.isConfigured()).toBe(false);
    expect(await store.health()).toBe(false);
    await expect(store.count('index')).rejects.toThrow('disabled');
    await store.onApplicationShutdown();
  });

  it('derives a bounded SQL identifier even from hostile index IDs', () => {
    expect(indexTable('a"; DROP TABLE dishes;--')).toMatch(
      /^recommendation_store\.v_[a-f0-9]{40}$/,
    );
    expect(indexTable('model-a')).not.toEqual(indexTable('model-b'));
  });

  it.each([0, -1, 2001, 1.5, NaN])(
    'rejects unsupported HNSW dimension %s before SQL',
    async (dimension) => {
      const store = new RecommendationStoreService(new ConfigService({}));
      await expect(store.createIndex('index', dimension)).rejects.toThrow(
        'dimension',
      );
    },
  );
});
