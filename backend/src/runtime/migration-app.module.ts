import { Module } from '@nestjs/common';
import { RuntimeConfigurationModule } from './configuration.module';
import { InitializationModule } from './initialization.module';

@Module({
  imports: [
    RuntimeConfigurationModule.forRole('migrate'),
    InitializationModule,
  ],
})
export class MigrationAppModule {}
