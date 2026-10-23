import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { recommendationDatabaseUrl } from './recommendation-database.config';

export interface VectorRecord {
  dishId: string;
  sourceRevision: bigint;
  embedding?: number[];
  filterPayload?: { canteenId?: string; [key: string]: unknown };
  deleted?: boolean;
}

export interface VectorHit {
  dishId: string;
  score: number;
}

export function indexTable(indexId: string): string {
  return `recommendation_store.v_${createHash('sha256').update(indexId).digest('hex').slice(0, 40)}`;
}

@Injectable()
export class RecommendationStoreService
  implements OnApplicationShutdown, OnModuleInit
{
  private readonly logger = new Logger(RecommendationStoreService.name);
  private readonly client?: PrismaClient;

  constructor(config: ConfigService) {
    const url = recommendationDatabaseUrl(
      config.get('RECOMMENDATION_DATABASE_URL'),
      config.get('DATABASE_URL'),
      config.get('NODE_ENV') === 'production',
    );
    if (url) this.client = new PrismaClient({ datasourceUrl: url });
  }

  isConfigured(): boolean {
    return !!this.client;
  }

  private db(): PrismaClient {
    if (!this.client)
      throw new Error(
        'Recommendation store is disabled: RECOMMENDATION_DATABASE_URL is missing',
      );
    return this.client;
  }

  async onModuleInit() {
    if (this.isConfigured() && !(await this.health())) {
      this.logger.warn(
        'Recommendation store is unavailable or requires migration; vector strategies will use their configured fallback',
      );
    }
  }

  async onApplicationShutdown() {
    await this.client?.$disconnect();
  }

  async health(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client
        .$queryRaw`SELECT id FROM recommendation_store.indexes LIMIT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async createIndex(indexId: string, dimension: number): Promise<void> {
    if (!Number.isInteger(dimension) || dimension < 1 || dimension > 2000) {
      throw new Error('Cosine HNSW dimension must be between 1 and 2000');
    }
    const table = indexTable(indexId);
    await this.db().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${indexId}, 0))`;
        const existing = await tx.$queryRaw<
          { dimension: number }[]
        >`SELECT dimension FROM recommendation_store.indexes WHERE id = ${indexId}`;
        if (existing.length && existing[0].dimension !== dimension)
          throw new Error('Index dimension is immutable');
        await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS ${table} (
        dish_id TEXT PRIMARY KEY, source_revision BIGINT NOT NULL,
        embedding vector(${dimension}), filter_payload JSONB NOT NULL DEFAULT '{}',
        deleted BOOLEAN NOT NULL DEFAULT false, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CHECK (deleted OR embedding IS NOT NULL)
      )`);
        await tx.$executeRawUnsafe(
          `CREATE INDEX IF NOT EXISTS ${table.split('.')[1]}_hnsw ON ${table} USING hnsw (embedding vector_cosine_ops) WHERE NOT deleted`,
        );
        await tx.$executeRaw`INSERT INTO recommendation_store.indexes (id, dimension) VALUES (${indexId}, ${dimension}) ON CONFLICT (id) DO NOTHING`;
      },
      { timeout: 120000 },
    );
  }

  private async dimension(indexId: string): Promise<number> {
    const rows = await this.db().$queryRaw<
      { dimension: number }[]
    >`SELECT dimension FROM recommendation_store.indexes WHERE id = ${indexId}`;
    if (!rows.length)
      throw new Error(`Recommendation index ${indexId} has not been built`);
    return rows[0].dimension;
  }

  private vector(values: number[], dimension: number): string {
    if (
      values.length !== dimension ||
      !values.every(Number.isFinite) ||
      !values.some((v) => v !== 0)
    ) {
      throw new Error(
        'Embedding must contain finite values, match index dimension, and have nonzero norm',
      );
    }
    return JSON.stringify(values);
  }

  async upsert(indexId: string, record: VectorRecord): Promise<void> {
    const dimension = await this.dimension(indexId);
    const vector = record.deleted
      ? null
      : this.vector(record.embedding ?? [], dimension);
    await this.db().$executeRaw(Prisma.sql`
      INSERT INTO ${Prisma.raw(indexTable(indexId))} AS current
        (dish_id, source_revision, embedding, filter_payload, deleted)
      VALUES (${record.dishId}, ${record.sourceRevision}, ${vector}::vector,
        ${JSON.stringify(record.filterPayload ?? {})}::jsonb, ${record.deleted ?? false})
      ON CONFLICT (dish_id) DO UPDATE SET
        source_revision = EXCLUDED.source_revision, embedding = EXCLUDED.embedding,
        filter_payload = EXCLUDED.filter_payload, deleted = EXCLUDED.deleted, updated_at = now()
      WHERE current.source_revision < EXCLUDED.source_revision
    `);
  }

  async search(
    indexId: string,
    embedding: number[],
    limit: number,
    filter?: { canteenIds?: string[]; excludeDishIds?: string[] },
  ): Promise<VectorHit[]> {
    const vector = this.vector(embedding, await this.dimension(indexId));
    if (!Number.isInteger(limit) || limit < 1 || limit > 2000)
      throw new Error('Search limit must be between 1 and 2000');
    const canteens = filter?.canteenIds?.length
      ? Prisma.sql`AND filter_payload->>'canteenId' IN (${Prisma.join(filter.canteenIds)})`
      : Prisma.empty;
    const excluded = filter?.excludeDishIds?.length
      ? Prisma.sql`AND dish_id NOT IN (${Prisma.join(filter.excludeDishIds)})`
      : Prisma.empty;
    return this.db().$queryRaw<VectorHit[]>(Prisma.sql`
      SELECT dish_id AS "dishId", 1 - (embedding <=> ${vector}::vector) AS score
      FROM ${Prisma.raw(indexTable(indexId))}
      WHERE NOT deleted ${canteens} ${excluded}
      ORDER BY embedding <=> ${vector}::vector LIMIT ${limit}
    `);
  }

  async count(indexId: string): Promise<number> {
    const rows = await this.db().$queryRaw<{ count: bigint }[]>(
      Prisma.sql`SELECT count(*) FROM ${Prisma.raw(indexTable(indexId))} WHERE NOT deleted`,
    );
    return Number(rows[0].count);
  }

  async dropIndex(indexId: string): Promise<void> {
    await this.db().$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${indexId}, 0))`;
      await tx.$executeRawUnsafe(`DROP TABLE IF EXISTS ${indexTable(indexId)}`);
      await tx.$executeRaw`DELETE FROM recommendation_store.indexes WHERE id = ${indexId}`;
    });
  }
}
