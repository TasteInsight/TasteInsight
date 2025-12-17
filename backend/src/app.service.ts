import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    await this.ensureInitialAdmin();
  }

  private async ensureInitialAdmin() {
    const adminCount = await this.prisma.admin.count();
    if (adminCount > 0) {
      return;
    }

    const username = this.configService.get<string>('INITIAL_ADMIN_USERNAME');
    const password = this.configService.get<string>('INITIAL_ADMIN_PASSWORD');

    if (!username || !password) {
      this.logger.warn(
        'No admins found and INITIAL_ADMIN_USERNAME/PASSWORD not set. Admin access may be unavailable.',
      );
      return;
    }

    this.logger.log('Creating initial superadmin user');

    const hashedPassword = await bcrypt.hash(password, 10);

    await this.prisma.admin.create({
      data: {
        username,
        password: hashedPassword,
        role: 'superadmin',
      },
    });

    this.logger.log('Initial superadmin created successfully.');
  }
}
