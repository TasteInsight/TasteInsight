/**
 * 配置模板初始化脚本
 *
 * 此脚本用于在生产环境中初始化配置模板。
 * 当服务启动时，AdminConfigService 的 onModuleInit 会自动同步配置模板，
 * 但如果需要手动初始化或调试，可以运行此脚本。
 *
 * 使用方法:
 *   npx ts-node prisma/init-config-templates.ts
 *
 * 或者使用 dotenv 加载环境变量:
 *   dotenv -e .env -- npx ts-node prisma/init-config-templates.ts
 */

import { PrismaClient } from '@prisma/client';
import { CONFIG_DEFINITIONS } from '@/admin-config/config-definitions';

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化配置模板...');
  console.log(`共有 ${CONFIG_DEFINITIONS.length} 个配置定义需要同步`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const definition of CONFIG_DEFINITIONS) {
    const existing = await prisma.adminConfigTemplate.findUnique({
      where: { key: definition.key },
    });

    if (!existing) {
      await prisma.adminConfigTemplate.create({
        data: {
          key: definition.key,
          defaultValue: definition.defaultValue,
          valueType: definition.valueType,
          description: definition.description,
          category: definition.category,
        },
      });
      console.log(`  ✅ 创建模板: ${definition.key}`);
      created++;
    } else if (
      existing.description !== definition.description ||
      existing.category !== definition.category ||
      existing.valueType !== definition.valueType
    ) {
      await prisma.adminConfigTemplate.update({
        where: { key: definition.key },
        data: {
          description: definition.description,
          category: definition.category,
          valueType: definition.valueType,
        },
      });
      console.log(`  🔄 更新模板: ${definition.key}`);
      updated++;
    } else {
      console.log(`  ⏭️ 跳过模板: ${definition.key} (无变化)`);
      skipped++;
    }
  }

  // 检查是否存在全局配置
  const globalConfig = await prisma.adminConfig.findFirst({
    where: { canteenId: null },
  });

  if (!globalConfig) {
    const newGlobalConfig = await prisma.adminConfig.create({
      data: { canteenId: null },
    });
    console.log(`\n✅ 创建全局配置: ${newGlobalConfig.id}`);

    // 为全局配置创建默认配置项
    const templates = await prisma.adminConfigTemplate.findMany();
    for (const template of templates) {
      await prisma.adminConfigItem.upsert({
        where: {
          adminConfigId_key: {
            adminConfigId: newGlobalConfig.id,
            key: template.key,
          },
        },
        update: {},
        create: {
          adminConfigId: newGlobalConfig.id,
          templateId: template.id,
          key: template.key,
          value: template.defaultValue,
          valueType: template.valueType,
          description: template.description,
          category: template.category,
        },
      });
    }
    console.log(`✅ 为全局配置创建了 ${templates.length} 个配置项`);
  } else {
    console.log(`\n⏭️ 全局配置已存在: ${globalConfig.id}`);
  }

  console.log('\n初始化完成:');
  console.log(`  创建: ${created}`);
  console.log(`  更新: ${updated}`);
  console.log(`  跳过: ${skipped}`);
}

main()
  .catch((e) => {
    console.error('初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
