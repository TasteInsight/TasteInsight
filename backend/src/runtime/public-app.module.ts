import { Module } from '@nestjs/common';
import { RuntimeInfrastructureModule } from './infrastructure.module';
import { PublicHttpModule } from './public-http.module';
import { HealthModule } from './health.module';
import { PublicFilesModule } from './public-files.module';
import { RuntimeConfigurationModule } from './configuration.module';

@Module({
  imports: [
    RuntimeConfigurationModule.forRole('public-api'),
    RuntimeInfrastructureModule,
    PublicHttpModule,
    HealthModule,
    PublicFilesModule,
  ],
})
export class PublicAppModule {}
