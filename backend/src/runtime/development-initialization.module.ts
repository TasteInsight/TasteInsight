import { Injectable, Module, OnApplicationBootstrap } from '@nestjs/common';
import { DatabaseInitializer } from './database-initializer.service';
import { InitializationModule } from './initialization.module';

@Injectable()
class DevelopmentInitializer implements OnApplicationBootstrap {
  constructor(private readonly initializer: DatabaseInitializer) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.initializer.initialize();
  }
}

@Module({
  imports: [InitializationModule],
  providers: [DevelopmentInitializer],
})
export class DevelopmentInitializationModule {}
