import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { migrateRecommendationStore } from '../scripts/recommendation-store-migrate';
import { spawnSync } from 'node:child_process';
import { DatabaseInitializer } from './runtime/database-initializer.service';
import { MigrationAppModule } from './runtime/migration-app.module';

export async function migrateAndInitialize(): Promise<void> {
  const app = await NestFactory.createApplicationContext(MigrationAppModule);
  try {
    const migration = spawnSync(
      process.execPath,
      [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
      { stdio: 'inherit', env: process.env },
    );
    if (migration.error) throw migration.error;
    if (migration.status !== 0) {
      throw new Error('Database migrations failed; initialization was skipped');
    }
    const recommendationUrl = app
      .get(ConfigService)
      .get<string>('RECOMMENDATION_DATABASE_URL')
      ?.trim();
    if (recommendationUrl) await migrateRecommendationStore(recommendationUrl);
    await app.get(DatabaseInitializer).initialize();
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  migrateAndInitialize().catch((error: Error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
