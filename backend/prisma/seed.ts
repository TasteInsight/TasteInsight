// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

  // 1. 清空所有数据，确保幂等性
  // 注意删除顺序，防止外键约束失败
  await prisma.aIRecommendationFeedback.deleteMany({});
  await prisma.aIRecommendation.deleteMany({});
  await prisma.mealPlanDish.deleteMany({});
  await prisma.mealPlan.deleteMany({});
  await prisma.browseHistory.deleteMany({});
  await prisma.favoriteDish.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.dishUpload.deleteMany({});
  await prisma.floor.deleteMany({});
  await prisma.news.deleteMany({});
  await prisma.operationLog.deleteMany({});
  await prisma.userPreference.deleteMany({});
  await prisma.adminPermission.deleteMany({});
  await prisma.dish.deleteMany({});
  await prisma.window.deleteMany({});
  await prisma.canteen.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.admin.deleteMany({});

  // 2. 创建一个可用于所有测试的【基础管理员】(superadmin)
  const hashedPassword = await bcrypt.hash('password123', 10);
  const admin = await prisma.admin.create({
    data: {
      username: 'testadmin',
      password: hashedPassword,
      role: 'superadmin',
    },
  });
  console.log(`Created baseline admin: ${admin.username}`);

  // 创建一个普通管理员用于测试权限
  const normalAdminPassword = await bcrypt.hash('admin123', 10);
  const normalAdmin = await prisma.admin.create({
    data: {
      username: 'normaladmin',
      password: normalAdminPassword,
      role: 'admin',
    },
  });
  console.log(`Created normal admin: ${normalAdmin.username}`);

  // 为普通管理员添加查看权限
  await prisma.adminPermission.create({
    data: {
      adminId: normalAdmin.id,
      permission: 'dish:view',
    },
  });
  console.log(`Added dish:view permission to normaladmin`);

  // 创建一个仅有部分权限的管理员
  const limitedAdminPassword = await bcrypt.hash('limited123', 10);
  const limitedAdmin = await prisma.admin.create({
    data: {
      username: 'limitedadmin',
      password: limitedAdminPassword,
      role: 'admin',
    },
  });
  console.log(`Created limited admin: ${limitedAdmin.username}`);

  // 为限制管理员添加查看和编辑权限
  await prisma.adminPermission.createMany({
    data: [
      {
        adminId: limitedAdmin.id,
        permission: 'dish:view',
      },
      {
        adminId: limitedAdmin.id,
        permission: 'dish:edit',
      },
    ],
  });
  console.log(`Added dish:view and dish:edit permissions to limitedadmin`);

  // 3. 创建两个可用于测试的【基础用户】
  const user = await prisma.user.create({
    data: {
        openId: 'baseline_user_openid',
        nickname: 'Baseline User',
        avatar: 'https://example.com/avatar.jpg',
        allergens: ['芒果'],
    }
  });
  console.log(`Created baseline user: ${user.nickname}`);

  const secondaryUser = await prisma.user.create({
    data: {
      openId: 'secondary_user_openid',
      nickname: 'Secondary User',
      avatar: 'https://example.com/avatar2.jpg',
      allergens: [],
    },
  });
  console.log(`Created secondary user: ${secondaryUser.nickname}`);

  // 创建一个绑定到食堂的管理员
  const canteenAdminPassword = await bcrypt.hash('canteen123', 10);
  // 注意：这里我们暂时不设置 canteenId，等食堂创建后再更新
  // 我们先创建一个占位的管理员
  let canteenAdmin = await prisma.admin.create({
    data: {
      username: 'canteenadmin',
      password: canteenAdminPassword,
      role: 'admin',
    },
  });
  console.log(`Created canteen admin: ${canteenAdmin.username}`);

  // 为食堂管理员添加所有菜品权限
  await prisma.adminPermission.createMany({
    data: [
      {
        adminId: canteenAdmin.id,
        permission: 'dish:view',
      },
      {
        adminId: canteenAdmin.id,
        permission: 'dish:create',
      },
      {
        adminId: canteenAdmin.id,
        permission: 'dish:edit',
      },
      {
        adminId: canteenAdmin.id,
        permission: 'dish:delete',
      },
    ],
  });
  console.log(`Added all dish permissions to canteenadmin`);

  // 4. 创建测试食堂
  const canteen1 = await prisma.canteen.create({
    data: {
      name: '第一食堂',
      position: '校园东区',
      description: '学校最大的食堂，提供各种美食',
      images: ['https://example.com/canteen1.jpg'],
      openingHours: {
        breakfast: '07:00-09:00',
        lunch: '11:00-13:00',
        dinner: '17:00-19:00',
      },
    },
  });
  console.log(`Created canteen: ${canteen1.name}`);

  const canteen2 = await prisma.canteen.create({
    data: {
      name: '第二食堂',
      position: '校园西区',
      description: '特色菜品食堂',
      images: ['https://example.com/canteen2.jpg'],
      openingHours: {
        breakfast: '07:00-09:00',
        lunch: '11:00-13:00',
        dinner: '17:00-19:00',
      },
    },
  });
  console.log(`Created canteen: ${canteen2.name}`);

  // 更新食堂管理员，绑定到第一食堂
  canteenAdmin = await prisma.admin.update({
    where: { id: canteenAdmin.id },
    data: { canteenId: canteen1.id },
  });
  console.log(`Updated canteenadmin with canteenId: ${canteen1.id}`);

  // 4.5. 创建楼层
  const floor1 = await prisma.floor.create({
    data: {
      canteenId: canteen1.id,
      level: '1',
      name: '一楼',
    },
  });
  console.log(`Created floor: ${floor1.name} for ${canteen1.name}`);

  const floor2 = await prisma.floor.create({
    data: {
      canteenId: canteen2.id,
      level: '1',
      name: '一楼',
    },
  });
  console.log(`Created floor: ${floor2.name} for ${canteen2.name}`);

  // 为用户创建偏好设置
  await prisma.userPreference.create({
    data: {
      userId: user.id,
      tagPreferences: ['川菜', '粤菜'],
      priceMin: 5,
      priceMax: 30,
      meatPreference: ['鸡肉', '鱼'],
      avoidIngredients: ['花生'],
      favoriteIngredients: ['鸡肉', '蔬菜'],
      spicyLevel: 2,
      sweetness: 2,
      saltiness: 2,
      oiliness: 2,
      canteenPreferences: [canteen1.id, canteen2.id],
      portionSize: 'medium',
      newDishAlert: true,
      priceChangeAlert: false,
      reviewReplyAlert: true,
      weeklyRecommendation: true,
      showCalories: true,
      showNutrition: false,
      defaultSortBy: 'rating',
    },
  });
  console.log(`Created user preferences for ${user.nickname}`);

  // 5. 创建测试窗口
  const window1 = await prisma.window.create({
    data: {
      canteenId: canteen1.id,
      floorId: floor1.id,
      name: '川菜窗口',
      number: 'A1',
      position: '一楼东侧',
      description: '提供正宗川菜',
      tags: ['川菜', '辣味'],
    },
  });
  console.log(`Created window: ${window1.name}`);

  const window2 = await prisma.window.create({
    data: {
      canteenId: canteen1.id,
      floorId: floor1.id,
      name: '粤菜窗口',
      number: 'A2',
      position: '一楼西侧',
      description: '提供清淡粤菜',
      tags: ['粤菜', '清淡'],
    },
  });
  console.log(`Created window: ${window2.name}`);

  const window3 = await prisma.window.create({
    data: {
      canteenId: canteen2.id,
      floorId: floor2.id,
      name: '面食窗口',
      number: 'B1',
      position: '一楼中央',
      description: '各种面食',
      tags: ['面食', '主食'],
    },
  });
  console.log(`Created window: ${window3.name}`);

  // 6. 创建测试菜品
  const dish1 = await prisma.dish.create({
    data: {
      name: '宫保鸡丁',
      tags: ['川菜', '家常菜', '鸡肉'],
      price: 15.0,
      description: '经典川菜，鸡肉鲜嫩，花生酥脆',
      images: ['https://example.com/dish1.jpg'],
      ingredients: ['鸡肉', '花生', '辣椒', '葱', '姜', '蒜'],
      allergens: ['花生'],
      spicyLevel: 3,
      sweetness: 2,
      saltiness: 3,
      oiliness: 3,
      canteenId: canteen1.id,
      canteenName: canteen1.name,
      floorId: floor1.id,
      floorLevel: floor1.level,
      floorName: floor1.name,
      windowId: window1.id,
      windowNumber: window1.number,
      windowName: window1.name,
      availableMealTime: ['lunch', 'dinner'],
      status: 'online',
      averageRating: 4.5,
      reviewCount: 120,
    },
  });
  console.log(`Created dish: ${dish1.name}`);

  const dish2 = await prisma.dish.create({
    data: {
      name: '清蒸鲈鱼',
      tags: ['粤菜', '海鲜', '清淡'],
      price: 28.0,
      description: '新鲜鲈鱼清蒸，保留鱼肉鲜美',
      images: ['https://example.com/dish2.jpg'],
      ingredients: ['鲈鱼', '姜', '葱', '料酒'],
      allergens: ['海鲜'],
      spicyLevel: 0,
      sweetness: 1,
      saltiness: 2,
      oiliness: 1,
      canteenId: canteen1.id,
      canteenName: canteen1.name,
      floorId: floor1.id,
      floorLevel: floor1.level,
      floorName: floor1.name,
      windowId: window2.id,
      windowNumber: window2.number,
      windowName: window2.name,
      availableMealTime: ['lunch', 'dinner'],
      status: 'online',
      averageRating: 4.8,
      reviewCount: 85,
    },
  });
  console.log(`Created dish: ${dish2.name}`);

  const dish3 = await prisma.dish.create({
    data: {
      name: '牛肉面',
      tags: ['面食', '主食', '牛肉'],
      price: 12.0,
      description: '手工拉面，牛肉炖得软烂',
      images: ['https://example.com/dish3.jpg'],
      ingredients: ['牛肉', '面粉', '葱', '香菜', '辣椒油'],
      allergens: ['面筋'],
      spicyLevel: 2,
      sweetness: 1,
      saltiness: 3,
      oiliness: 3,
      canteenId: canteen2.id,
      canteenName: canteen2.name,
      floorId: floor2.id,
      floorLevel: floor2.level,
      floorName: floor2.name,
      windowId: window3.id,
      windowNumber: window3.number,
      windowName: window3.name,
      availableMealTime: ['breakfast', 'lunch', 'dinner'],
      status: 'online',
      averageRating: 4.3,
      reviewCount: 200,
    },
  });
  console.log(`Created dish: ${dish3.name}`);

  const dish4 = await prisma.dish.create({
    data: {
      name: '麻婆豆腐',
      tags: ['川菜', '素菜', '豆制品'],
      price: 10.0,
      description: '麻辣鲜香，豆腐嫩滑',
      images: ['https://example.com/dish4.jpg'],
      ingredients: ['豆腐', '牛肉末', '豆瓣酱', '花椒', '辣椒'],
      allergens: ['大豆'],
      spicyLevel: 4,
      sweetness: 1,
      saltiness: 4,
      oiliness: 4,
      canteenId: canteen1.id,
      canteenName: canteen1.name,
      floorId: floor1.id,
      floorLevel: floor1.level,
      floorName: floor1.name,
      windowId: window1.id,
      windowNumber: window1.number,
      windowName: window1.name,
      availableMealTime: ['lunch', 'dinner'],
      status: 'online',
      averageRating: 4.6,
      reviewCount: 150,
    },
  });
  console.log(`Created dish: ${dish4.name}`);

  const dish5 = await prisma.dish.create({
    data: {
      name: '番茄炒蛋',
      tags: ['家常菜', '素菜'],
      price: 8.0,
      description: '简单美味的家常菜',
      images: ['https://example.com/dish5.jpg'],
      ingredients: ['番茄', '鸡蛋', '葱', '盐', '糖'],
      allergens: ['鸡蛋'],
      spicyLevel: 0,
      sweetness: 3,
      saltiness: 2,
      oiliness: 2,
      canteenId: canteen1.id,
      canteenName: canteen1.name,
      floorId: floor1.id,
      floorLevel: floor1.level,
      floorName: floor1.name,
      windowId: window2.id,
      windowNumber: window2.number,
      windowName: window2.name,
      availableMealTime: ['breakfast', 'lunch', 'dinner'],
      status: 'online',
      averageRating: 4.2,
      reviewCount: 180,
    },
  });
  console.log(`Created dish: ${dish5.name}`);

  // 7. 创建一个离线的菜品用于测试筛选
  const dish6 = await prisma.dish.create({
    data: {
      name: '季节性烤鱼',
      tags: ['烧烤', '海鲜'],
      price: 35.0,
      description: '季节性菜品，目前不供应',
      images: ['https://example.com/dish6.jpg'],
      ingredients: ['鱼', '调料'],
      allergens: ['海鲜'],
      spicyLevel: 3,
      sweetness: 2,
      saltiness: 3,
      oiliness: 4,
      canteenId: canteen2.id,
      canteenName: canteen2.name,
      floorId: floor2.id,
      floorLevel: floor2.level,
      floorName: floor2.name,
      windowId: window3.id,
      windowNumber: window3.number,
      windowName: window3.name,
      availableMealTime: ['dinner'],
      status: 'offline',
      averageRating: 4.7,
      reviewCount: 45,
    },
  });
  console.log(`Created offline dish: ${dish6.name}`);

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
