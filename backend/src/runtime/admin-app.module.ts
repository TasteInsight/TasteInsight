import { Module } from '@nestjs/common';
import { RuntimeInfrastructureModule } from './infrastructure.module';
import { AdminHttpModule } from './admin-http.module';
import { HealthModule } from './health.module';
import { RuntimeConfigurationModule } from './configuration.module';

@Module({
  imports: [
    RuntimeConfigurationModule.forRole('admin-api'),
    RuntimeInfrastructureModule,
    AdminHttpModule,
    HealthModule,
  ],
})
export class AdminAppModule {}
