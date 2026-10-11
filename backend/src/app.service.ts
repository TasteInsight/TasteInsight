import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  async getHealth(): Promise<{ status: 'ok' }> {
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) => {
          deadline = setTimeout(
            () => reject(new Error('Readiness timeout')),
            2000,
          );
        }),
      ]);
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Service unavailable');
    } finally {
      if (deadline) clearTimeout(deadline);
    }
  }
}
