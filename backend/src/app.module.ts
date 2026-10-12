import { Module } from '@nestjs/common';
import { DevelopmentInitializationModule } from './runtime/development-initialization.module';
import { RuntimeInfrastructureModule } from './runtime/infrastructure.module';
import { DevelopmentHttpModule } from './runtime/development-http.module';
import { BackgroundWorkersModule } from './runtime/background-workers.module';
import { HealthModule } from './runtime/health.module';
import { PublicFilesModule } from './runtime/public-files.module';
import { RuntimeConfigurationModule } from './runtime/configuration.module';

/** Combined application for local development and integration tests. */
@Module({
  imports: [
    RuntimeConfigurationModule.forRole('combined'),
    RuntimeInfrastructureModule,
    DevelopmentInitializationModule,
    DevelopmentHttpModule,
    BackgroundWorkersModule,
    HealthModule,
    PublicFilesModule,
  ],
})
export class AppModule {}
