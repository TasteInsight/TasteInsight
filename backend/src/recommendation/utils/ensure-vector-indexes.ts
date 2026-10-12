import { Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';

const embeddingDimensions = new Map([
  ['v1', 128],
  ['v2', 788],
  ['v3', 256],
]);

/** Create version-specific HNSW indexes during database initialization. */
export async function ensureVectorIndexes(
  prisma: PrismaService,
): Promise<void> {
  const logger = new Logger('EmbeddingIndexes');
  try {
    const versions = await prisma.$queryRaw<
      Array<{ version: string; count: bigint }>
    >`
      SELECT version, COUNT(*) as count
      FROM "dish_embeddings"
      WHERE embedding IS NOT NULL
      GROUP BY version
    `;

    for (const { version, count } of versions) {
      const dimension = embeddingDimensions.get(version);
      if (!dimension) {
        logger.warn(
          `Unknown embedding version: ${version}, skipping index creation`,
        );
        continue;
      }
      logger.log(
        `Found ${count} ${version} embeddings (${dimension}D), ensuring index...`,
      );
      try {
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "dish_embeddings_embedding_${version}_idx"
          ON "dish_embeddings" USING hnsw ((embedding::vector(${dimension})) vector_cosine_ops)
          WITH (m = 16, ef_construction = 200)
          WHERE version = '${version}' AND embedding IS NOT NULL
        `);
        logger.log(`HNSW index for ${version} created/verified`);
      } catch (error) {
        logger.error(`Failed to create index for ${version}: ${error.message}`);
      }
    }
  } catch (error) {
    logger.error(`Failed to ensure vector indexes: ${error.message}`);
  }
}
