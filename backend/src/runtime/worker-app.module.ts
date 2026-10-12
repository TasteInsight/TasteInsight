import { Module } from '@nestjs/common';
import { RuntimeInfrastructureModule } from './infrastructure.module';
import { BackgroundWorkersModule } from './background-workers.module';
import { WorkerHealthModule } from './worker-health.module';
import { RuntimeConfigurationModule } from './configuration.module';

@Module({
  imports: [
    RuntimeConfigurationModule.forRole('worker'),
    RuntimeInfrastructureModule,
    BackgroundWorkersModule,
    WorkerHealthModule,
  ],
})
export class WorkerAppModule {}
