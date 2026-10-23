import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma.service';

export async function controlTransaction<T>(
  prisma: PrismaService,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (error.code !== 'P2034' || attempt >= 2) throw error;
    }
  }
}
