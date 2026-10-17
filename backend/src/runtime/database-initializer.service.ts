import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AdminConfigService } from '../admin-config/admin-config.service';
import { PrismaService } from '../prisma.service';
import { ensureVectorIndexes } from '../recommendation/utils/ensure-vector-indexes';

@Injectable()
export class DatabaseInitializer {
  private readonly logger = new Logger(DatabaseInitializer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly adminConfig: AdminConfigService,
  ) {}

  async initialize(): Promise<void> {
    await this.adminConfig.syncConfigTemplates();
    await this.ensureInitialAdmin();
    await ensureVectorIndexes(this.prisma);
  }

  private async ensureInitialAdmin(): Promise<void> {
    if ((await this.prisma.admin.count()) > 0) return;
    const username = this.config.get<string>('INITIAL_ADMIN_USERNAME');
    const password = this.config.get<string>('INITIAL_ADMIN_PASSWORD');
    if (!username || !password) {
      this.logger.warn(
        'No administrators exist. Set INITIAL_ADMIN_USERNAME and INITIAL_ADMIN_PASSWORD and run database initialization.',
      );
      return;
    }
    await this.prisma.admin.create({
      data: {
        username,
        password: await bcrypt.hash(password, 10),
        role: 'superadmin',
        scope: 'GLOBAL',
      },
    });
    this.logger.log('Initial administrator created');
  }
}
