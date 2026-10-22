import {
  Injectable,
  Optional,
  OnModuleInit,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnApplicationShutdown
{
  constructor(@Optional() options: Prisma.PrismaClientOptions = {}) {
    super({
      ...options,
      omit: {
        ...options.omit,
        dish: { ...options.omit?.dish, allergenKeys: true },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onApplicationShutdown() {
    await this.$disconnect();
  }
}
