import {
  Injectable,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma.service';
import type { AdminInfo } from '@/auth/decorators/current-admin.decorator';
import {
  allergenComparisonKey,
  expandAllergenValues,
  normalizeAllergenText,
  normalizeAllergenValues,
} from './allergen-values';
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
          ? ((await tx.allergen.findMany({ include: { aliases: true } })).find(
              (entry) =>
                allergenComparisonKey(entry.value) ===
                allergenComparisonKey(value),
            ) ?? null)
          : null;
        if (value && !previous) throw new NotFoundException('过敏原不存在');
        const nameZh = normalizeAllergenText(dto.nameZh);
        const nameEn =
          dto.nameEn === undefined
            ? previous?.nameEn
            : dto.nameEn
              ? normalizeAllergenText(dto.nameEn) || null
              : null;
        const key = previous?.value ?? nameZh;
        const names = normalizeAllergenValues([
          key,
          nameZh,
          ...(nameEn ? [nameEn] : []),
          ...(dto.aliases ?? []),
          ...(previous
            ? [previous.nameZh, ...(previous.nameEn ? [previous.nameEn] : [])]
            : []),
          ...(previous?.aliases.map((alias) => alias.name) ?? []),
        ]);
        const entry = previous
          ? await tx.allergen.update({
              where: { value: key },
              data: {
                nameZh,
                ...(dto.nameEn !== undefined ? { nameEn } : {}),
              },
            })
          : await tx.allergen.create({
              data: {
                value: key,
                nameZh,
                nameEn: nameEn ?? null,
              },
            });
        const existing = new Set(
          previous?.aliases.map((alias) => allergenComparisonKey(alias.name)) ??
            [],
        );
        const additions = names.filter(
          (name) => !existing.has(allergenComparisonKey(name)),
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
              nameZh,
              nameEn: entry.nameEn,
              aliases: names,
            },
          },
        });
        return { ...entry, aliases: names };
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
