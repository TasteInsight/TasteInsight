import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { loadDatabaseEnvironment } from '../src/database-url';
import { recommendationDatabaseUrl } from '../src/recommendation-store/recommendation-database.config';

export async function migrateRecommendationStore(url: string) {
  if (!url?.trim()) throw new Error('RECOMMENDATION_DATABASE_URL is required');
  const validatedUrl = recommendationDatabaseUrl(
    url,
    process.env.DATABASE_URL,
    process.env.NODE_ENV === 'production',
  );
  const client = new PrismaClient({ datasourceUrl: validatedUrl });
  try {
    const adjacent = resolve(
      __dirname,
      '../recommendation-migrations/001_store.sql',
    );
    const migrationPath = existsSync(adjacent)
      ? adjacent
      : resolve(process.cwd(), 'recommendation-migrations/001_store.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    await client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(726381920)`;
      for (const statement of sql.split(';').filter((part) => part.trim())) {
        await tx.$executeRawUnsafe(statement);
      }
    });
  } finally {
    await client.$disconnect();
  }
}

if (require.main === module) {
  loadDatabaseEnvironment();
  void migrateRecommendationStore(
    process.env.RECOMMENDATION_DATABASE_URL ?? '',
  ).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
