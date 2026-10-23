import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RecommendationCacheService } from '@/recommendation/services/cache.service';
import { digest } from './strategy-config';

@Injectable()
export class RecommendationSessionService {
  constructor(private readonly cache: RecommendationCacheService) {}
  async resolve(
    userId: string,
    requestedId: string | undefined,
    input: unknown,
  ): Promise<string> {
    const fingerprint = digest(input);
    const redis = this.cache.getRedisClient();
    if (requestedId) {
      const cached = await redis.get(
        `rec:session-owner:${digest(requestedId)}`,
      );
      if (cached) {
        const session = JSON.parse(cached);
        if (session.userId === userId && session.fingerprint === fingerprint)
          return requestedId;
      }
    }
    const id = randomUUID();
    await redis.setex(
      `rec:session-owner:${digest(id)}`,
      1800,
      JSON.stringify({ userId, fingerprint }),
    );
    return id;
  }
}
