import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ModelRuntimeService } from '../recommendation-platform/model-runtime.service';
import { RecommendationStoreService } from './recommendation-store.service';

type Projection = {
  dishId: string;
  revision: bigint;
  payload: Record<string, unknown> | null;
  deleted: boolean;
};

@Injectable()
export class RecommendationIndexSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: ModelRuntimeService,
    private readonly store: RecommendationStoreService,
  ) {}

  async progress(id: string): Promise<{
    pending: number;
    failed: number;
    total: number;
    applied: number;
  }> {
    const [result] = await this.prisma.$queryRaw<
      { pending: bigint; failed: bigint; total: bigint; applied: bigint }[]
    >(Prisma.sql`
      SELECT count(*) AS total,
        count(*) FILTER (WHERE COALESCE(t.revision, 0) < p.revision) AS pending,
        count(*) FILTER (WHERE COALESCE(t.revision, 0) < p.revision AND t."lastError" IS NOT NULL) AS failed,
        count(*) FILTER (WHERE t.revision >= p.revision) AS applied
      FROM recommendation_projections p LEFT JOIN recommendation_index_tasks t
      ON t."dishId" = p."dishId" AND t."indexId" = ${id}
    `);
    return {
      pending: Number(result.pending),
      failed: Number(result.failed),
      total: Number(result.total),
      applied: Number(result.applied),
    };
  }

  async syncIndex(
    id: string,
    batchSize = 100,
  ): Promise<{ processed: number; pending: number; failed: number }> {
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000)
      throw new Error('Sync batch size must be between 1 and 1000');
    const index = await this.prisma.recommendationIndex.findUniqueOrThrow({
      where: { id },
      include: { model: true },
    });
    if (!['building', 'ready'].includes(index.status))
      return { processed: 0, ...(await this.pending(id)) };
    try {
      if (!this.store.isConfigured())
        throw new Error('Recommendation store is disabled');
      if (
        index.model.status !== 'ready' ||
        index.model.kind !== 'embedding' ||
        !index.model.dimension
      )
        throw new Error('Index requires a ready embedding model');
      if (index.status === 'building')
        await this.store.createIndex(id, index.model.dimension);
      const projections = await this.prisma.$queryRaw<Projection[]>(Prisma.sql`
        SELECT p."dishId", p.revision, p.payload, p.deleted
        FROM recommendation_projections p LEFT JOIN recommendation_index_tasks t
          ON t."dishId" = p."dishId" AND t."indexId" = ${id}
        WHERE COALESCE(t.revision, 0) < p.revision
        ORDER BY t."updatedAt" ASC NULLS FIRST, p."dishId" ASC LIMIT ${batchSize}
      `);
      let processed = 0;
      for (const projection of projections) {
        try {
          const payload = projection.payload ?? {};
          const embedding = projection.deleted
            ? undefined
            : await this.runtime.generateDish(
                index.model,
                payload,
                index.parameters,
              );
          await this.store.upsert(id, {
            dishId: projection.dishId,
            sourceRevision: projection.revision,
            embedding,
            filterPayload: {
              canteenId: payload.canteenId as string | undefined,
            },
            deleted: projection.deleted,
          });
          // The target store write precedes acknowledgement; replay after a crash is idempotent.
          if (!(await this.acknowledge(id, index.generation, projection, null)))
            break;
          processed++;
        } catch (error) {
          if (
            !(await this.acknowledge(
              id,
              index.generation,
              projection,
              this.errorMessage(error),
            ))
          )
            break;
        }
      }

      // One statement takes the acceptance snapshot. Later commits stay pending for subsequent syncs.
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE recommendation_indexes SET status = 'ready', "readyAt" = COALESCE("readyAt", now()),
          "lastSyncedAt" = now(), "lastError" = NULL
        WHERE id = ${id} AND generation = ${index.generation} AND status IN ('building', 'ready') AND NOT EXISTS (
          SELECT 1 FROM recommendation_projections p LEFT JOIN recommendation_index_tasks t
          ON t."dishId" = p."dishId" AND t."indexId" = ${id}
          WHERE COALESCE(t.revision, 0) < p.revision
        )
      `);
      const progress = await this.pending(id);
      await this.prisma.recommendationIndex.updateMany({
        where: {
          id,
          generation: index.generation,
          status: { in: ['building', 'ready'] },
        },
        data: {
          lastSyncedAt: new Date(),
          lastError: progress.failed
            ? `${progress.failed} projection(s) require retry`
            : null,
        },
      });
      return { processed, ...progress };
    } catch (error) {
      await this.prisma.recommendationIndex.updateMany({
        where: {
          id,
          generation: index.generation,
          status: { in: ['building', 'ready'] },
        },
        data: { lastError: this.errorMessage(error) },
      });
      throw error;
    }
  }

  private async acknowledge(
    id: string,
    generation: number,
    projection: Projection,
    error: string | null,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      // A row version change orders acknowledgements against Serializable rebuilds.
      // Rebuilds that raced this update retry with a snapshot containing the task write.
      const active = await tx.$executeRaw(Prisma.sql`
        UPDATE recommendation_indexes SET "lastSyncedAt" = now()
        WHERE id = ${id} AND generation = ${generation} AND status IN ('building', 'ready')
      `);
      if (!active) return false;
      if (error === null) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO recommendation_index_tasks AS current ("indexId", "dishId", revision, "lastError", attempts, "updatedAt")
          VALUES (${id}, ${projection.dishId}, ${projection.revision}, NULL, 1, now())
          ON CONFLICT ("indexId", "dishId") DO UPDATE SET
            revision = EXCLUDED.revision,
            "lastError" = CASE WHEN (SELECT revision FROM recommendation_projections WHERE "dishId" = ${projection.dishId}) <= EXCLUDED.revision THEN NULL ELSE current."lastError" END,
            attempts = current.attempts + 1, "updatedAt" = now()
          WHERE current.revision < EXCLUDED.revision
        `);
      } else {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO recommendation_index_tasks AS current ("indexId", "dishId", revision, "lastError", attempts, "updatedAt")
          SELECT ${id}, ${projection.dishId}, 0, ${error}, 1, now()
          WHERE EXISTS (SELECT 1 FROM recommendation_projections WHERE "dishId" = ${projection.dishId} AND revision = ${projection.revision})
          ON CONFLICT ("indexId", "dishId") DO UPDATE SET
            "lastError" = EXCLUDED."lastError", attempts = current.attempts + 1, "updatedAt" = now()
          WHERE current.revision < ${projection.revision}
        `);
      }
      return true;
    });
  }

  private async pending(id: string) {
    const { pending, failed } = await this.progress(id);
    return { pending, failed };
  }

  private errorMessage(error: unknown): string {
    return (error instanceof Error ? error.message : String(error)).slice(
      0,
      2000,
    );
  }
}
