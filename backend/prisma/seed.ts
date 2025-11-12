// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

  // 1. 清空所有数据，确保幂等性
  // 注意删除顺序，防止外键约束失败
  await prisma.user.deleteMany({});
  await prisma.admin.deleteMany({});

  // 2. 创建一个可用于所有测试的【基础管理员】
  const hashedPassword = await bcrypt.hash('password123', 10);
  const admin = await prisma.admin.create({
    data: {
      username: 'testadmin',
      password: hashedPassword,
      role: 'superadmin',
    },
  });
  console.log(`Created baseline admin: ${admin.username}`);

  // 3. 创建一个可用于测试的【基础用户】
  const user = await prisma.user.create({
    data: {
        openId: 'baseline_user_openid',
        nickname: 'Baseline User',
        allergens: ['芒果'],
    }
  });
  console.log(`Created baseline user: ${user.nickname}`);

  console.log(`Seeding finished.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });