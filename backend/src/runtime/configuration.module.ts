import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  environmentFileOptions,
  validateEnvironment,
  type RuntimeRole,
} from '../environment';

@Module({})
export class RuntimeConfigurationModule {
  static forRole(role: RuntimeRole): DynamicModule {
    return {
      module: RuntimeConfigurationModule,
      imports: [
        ConfigModule.forRoot({
          ...environmentFileOptions(process.env),
          isGlobal: true,
          validate: (environment) => validateEnvironment(environment, role),
        }),
      ],
      exports: [ConfigModule],
    };
  }
}
