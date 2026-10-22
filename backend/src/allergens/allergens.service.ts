import {
  Injectable,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma.service';
import type { AdminInfo } from '@/auth/decorators/current-admin.decorator';
import { expandAllergenValues } from './allergen-values';
import { SaveAllergenDto } from './allergens.dto';

@Injectable()
export class AllergensService {
  constructor(private readonly prisma: PrismaService) {}

  async catalog(db: Pick<Prisma.TransactionClient, 'allergen'> = this.prisma) {
    const entries = await db.allergen.findMany({
      include: { aliases: true },
      orderBy: { value: 'asc' },
    });
    return entries.map(({ aliases, ...entry }) => ({
      ...entry,
      aliases: aliases.map((alias) => alias.name),
    }));
  }

  async expandValues(
    values: string[],
    db: Pick<Prisma.TransactionClient, 'allergen'> = this.prisma,
  ) {
    return values.length
      ? expandAllergenValues(values, await this.catalog(db))
      : [];
  }

  async save(dto: SaveAllergenDto, admin: AdminInfo, value?: string) {
    if (admin.scope !== 'GLOBAL')
      throw new ForbiddenException('词表维护需要全局管理权限');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const previous = value
          ? await tx.allergen.findUnique({
              where: { value },
              include: { aliases: true },
            })
          : null;
        if (value && !previous) throw new NotFoundException('过敏原不存在');
        const key = previous?.value ?? dto.nameZh.trim();
        const names = new Map<string, string>();
        for (const name of [
          key,
          dto.nameZh,
          dto.nameEn,
          ...(dto.aliases ?? []),
          ...(previous?.aliases.map((alias) => alias.name) ?? []),
        ]) {
          const trimmed = name?.trim();
          if (trimmed) names.set(trimmed.toLowerCase(), trimmed);
        }
        const entry = previous
          ? await tx.allergen.update({
              where: { value: key },
              data: {
                nameZh: dto.nameZh,
                ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn } : {}),
              },
            })
          : await tx.allergen.create({
              data: {
                value: key,
                nameZh: dto.nameZh,
                nameEn: dto.nameEn ?? null,
              },
            });
        const existing = new Set(
          previous?.aliases.map((alias) => alias.name.toLowerCase()) ?? [],
        );
        const additions = [...names.values()].filter(
          (name) => !existing.has(name.toLowerCase()),
        );
        if (additions.length)
          await tx.allergenAlias.createMany({
            data: additions.map((name) => ({ name, allergenValue: key })),
          });
        await tx.operationLog.create({
          data: {
            adminId: admin.id,
            action: previous ? 'allergen:update' : 'allergen:create',
            targetType: 'allergen',
            targetId: key,
            result: 'success',
            details: {
              nameZh: dto.nameZh,
              nameEn: entry.nameEn,
              aliases: [...names.values()],
            },
          },
        });
        return { ...entry, aliases: [...names.values()] };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('名称或别名已用于其他过敏原');
      throw error;
    }
  }
}
