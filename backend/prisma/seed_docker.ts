// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ==================== K6 性能测试专用配置 ====================
/**
 * K6 性能测试需要的测试数据量配置
 * 
 * 这些配置确保有足够的数据供 K6 并发测试使用
 * 可通过环境变量调整：
 *   K6_PENDING_UPLOADS=20    - 待审核上传数量
 *   K6_PENDING_REVIEWS=15    - 待审核评价数量
 *   K6_PENDING_COMMENTS=15   - 待审核评论数量
 *   K6_PENDING_REPORTS=15    - 待处理举报数量
 *   K6_ONLINE_DISHES=20      - 在线菜品数量
 */
const K6_CONFIG = {
  PENDING_UPLOADS: parseInt(process.env.K6_PENDING_UPLOADS || '15'),
  PENDING_REVIEWS: parseInt(process.env.K6_PENDING_REVIEWS || '12'),
  PENDING_COMMENTS: parseInt(process.env.K6_PENDING_COMMENTS || '12'),
  PENDING_REPORTS: parseInt(process.env.K6_PENDING_REPORTS || '15'),
  ONLINE_DISHES: parseInt(process.env.K6_ONLINE_DISHES || '15'),
};

async function main() {
  console.log(`Start seeding ...`);
  console.log(`K6 Config: ${JSON.stringify(K6_CONFIG)}`);

  // 1. 清空所有数据，确保幂等性
  // 注意删除顺序，防止外键约束失败
  await prisma.mealPlanDish.deleteMany({});
  await prisma.mealPlan.deleteMany({});
  await prisma.browseHistory.deleteMany({});
  await prisma.favoriteDish.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.dishUpload.deleteMany({});
  await prisma.dish.deleteMany({});
  await prisma.window.deleteMany({});
  await prisma.floor.deleteMany({});
  await prisma.canteen.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.admin.deleteMany({});

  // 2. 创建一个可用于所有测试的【基础管理员】(superadmin)
  const adminUsername = process.env.INITIAL_ADMIN_USERNAME || 'testadmin';
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'password123';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.admin.create({
    data: {
      username: adminUsername,
      password: hashedPassword,
      role: 'superadmin',
    },
  });
  console.log(`Created baseline admin: ${admin.username}`);

  // 2.1 创建专门用于 K6 性能测试的 Super Admin
  // 这个账号拥有所有权限，密码符合安全要求（大小写+数字+特殊字符）
  const k6AdminPassword = process.env.K6_ADMIN_PASSWORD || 'K6Test@2024!Pwd';
  const k6HashedPassword = await bcrypt.hash(k6AdminPassword, 10);
  const k6Admin = await prisma.admin.create({
    data: {
      username: process.env.K6_ADMIN_USERNAME || 'k6admin',
      password: k6HashedPassword,
      role: 'superadmin',
    },
  });
  console.log(`Created K6 performance test admin: ${k6Admin.username}`);
  console.log(`  → Password: ${k6AdminPassword} (符合密码复杂度要求)`);

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

  // 创建一个有审核权限的管理员
  const reviewerAdminPassword = await bcrypt.hash('reviewer123', 10);
  const reviewerAdmin = await prisma.admin.create({
    data: {
      username: 'revieweradmin',
      password: reviewerAdminPassword,
      role: 'admin',
    },
  });
  console.log(`Created reviewer admin: ${reviewerAdmin.username}`);

  // 为审核管理员添加审核权限
  await prisma.adminPermission.createMany({
    data: [
      {
        adminId: reviewerAdmin.id,
        permission: 'upload:approve',
      },
      {
        adminId: reviewerAdmin.id,
        permission: 'review:approve',
      },
      {
        adminId: reviewerAdmin.id,
        permission: 'comment:approve',
      },
    ],
  });
  console.log(`Added upload:approve, review:approve and comment:approve permissions to revieweradmin`);

  // 创建一个有子管理员管理权限的管理员
  const adminManagerPassword = await bcrypt.hash('manager123', 10);
  const adminManager = await prisma.admin.create({
    data: {
      username: 'adminmanager',
      password: adminManagerPassword,
      role: 'admin',
    },
  });
  console.log(`Created admin manager: ${adminManager.username}`);

  // 为管理员管理者添加子管理员相关权限
  await prisma.adminPermission.createMany({
    data: [
      {
        adminId: adminManager.id,
        permission: 'admin:view',
      },
      {
        adminId: adminManager.id,
        permission: 'admin:create',
      },
      {
        adminId: adminManager.id,
        permission: 'admin:edit',
      },
      {
        adminId: adminManager.id,
        permission: 'admin:delete',
      },
    ],
  });
  console.log(`Added all admin management permissions to adminmanager`);

  // 创建一个由 adminManager 创建的子管理员，用于测试
  const subAdminPassword = await bcrypt.hash('subadmin123', 10);
  const subAdmin = await prisma.admin.create({
    data: {
      username: 'subadmin',
      password: subAdminPassword,
      role: 'admin',
      createdBy: adminManager.id,
    },
  });
  console.log(`Created sub admin: ${subAdmin.username}`);

  // 为子管理员添加一些基础权限
  await prisma.adminPermission.createMany({
    data: [
      {
        adminId: subAdmin.id,
        permission: 'dish:view',
      },
      {
        adminId: subAdmin.id,
        permission: 'canteen:view',
      },
    ],
  });
  console.log(`Added dish:view and canteen:view permissions to subadmin`);

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
  await prisma.admin.update({
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

  // --- EXTRA FLOORS FOR DOCKER SEED ---
  const floor1_2 = await prisma.floor.create({
    data: {
      canteenId: canteen1.id,
      level: '2',
      name: '二楼',
    },
  });
  console.log(`Created extra floor: ${floor1_2.name} for ${canteen1.name}`);

  const floor1_b1 = await prisma.floor.create({
    data: {
      canteenId: canteen1.id,
      level: '-1',
      name: '地下一层',
    },
  });
  console.log(`Created extra floor: ${floor1_b1.name} for ${canteen1.name}`);

  const floor2_2 = await prisma.floor.create({
    data: {
      canteenId: canteen2.id,
      level: '2',
      name: '二楼',
    },
  });
  console.log(`Created extra floor: ${floor2_2.name} for ${canteen2.name}`);
  // ------------------------------------

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
    },
  });
  console.log(`Created user preferences for ${user.nickname}`);

  // 为用户创建设置
  await prisma.userSetting.create({
    data: {
      userId: user.id,
      newDishAlert: true,
      priceChangeAlert: false,
      reviewReplyAlert: true,
      weeklyRecommendation: true,
      showCalories: true,
      showNutrition: false,
      defaultSortBy: 'rating',
    },
  });
  console.log(`Created user settings for ${user.nickname}`);

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

  // --- EXTRA WINDOWS FOR DOCKER SEED ---
  const window1_2_1 = await prisma.window.create({
    data: {
      canteenId: canteen1.id,
      floorId: floor1_2.id,
      name: '二楼特色窗',
      number: 'C1',
      position: '二楼南侧',
      description: '二楼特色菜',
      tags: ['特色', '炒菜'],
    },
  });
  console.log(`Created extra window: ${window1_2_1.name}`);

  const window1_b1_1 = await prisma.window.create({
    data: {
      canteenId: canteen1.id,
      floorId: floor1_b1.id,
      name: '地下小吃',
      number: 'D1',
      position: '地下一层入口',
      description: '各种小吃',
      tags: ['小吃', '快餐'],
    },
  });
  console.log(`Created extra window: ${window1_b1_1.name}`);
  // -------------------------------------

  // 6. 创建测试菜品
  const dish1 = await prisma.dish.create({
    data: {
      name: '宫保鸡丁',
      tags: ['川菜', '家常菜', '鸡肉'],
      price: 15.0,
      priceUnit: '份',
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
      priceUnit: '份',
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
      priceUnit: '份',
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
      priceUnit: '份',
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
      priceUnit: '份',
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

  // --- EXTRA DISHES FOR DOCKER SEED ---
  const dish7 = await prisma.dish.create({
    data: {
      name: '二楼小炒肉',
      tags: ['湘菜', '辣味'],
      price: 18.0,
      priceUnit: '份',
      description: '二楼招牌菜',
      images: ['https://example.com/dish_extra_1.jpg'],
      ingredients: ['猪肉', '辣椒'],
      allergens: [],
      spicyLevel: 4,
      sweetness: 1,
      saltiness: 3,
      oiliness: 4,
      canteenId: canteen1.id,
      canteenName: canteen1.name,
      floorId: floor1_2.id,
      floorLevel: floor1_2.level,
      floorName: floor1_2.name,
      windowId: window1_2_1.id,
      windowNumber: window1_2_1.number,
      windowName: window1_2_1.name,
      availableMealTime: ['lunch', 'dinner'],
      status: 'online',
      averageRating: 4.9,
      reviewCount: 10,
    },
  });
  console.log(`Created extra dish: ${dish7.name}`);

  const dish8 = await prisma.dish.create({
    data: {
      name: '地下炸鸡',
      tags: ['小吃', '炸物'],
      price: 12.0,
      priceUnit: '份',
      description: '酥脆炸鸡',
      images: ['https://example.com/dish_extra_2.jpg'],
      ingredients: ['鸡肉', '面粉'],
      allergens: ['面筋'],
      spicyLevel: 1,
      sweetness: 1,
      saltiness: 3,
      oiliness: 5,
      canteenId: canteen1.id,
      canteenName: canteen1.name,
      floorId: floor1_b1.id,
      floorLevel: floor1_b1.level,
      floorName: floor1_b1.name,
      windowId: window1_b1_1.id,
      windowNumber: window1_b1_1.number,
      windowName: window1_b1_1.name,
      availableMealTime: ['lunch', 'dinner', 'nightsnack'],
      status: 'online',
      averageRating: 4.5,
      reviewCount: 50,
    },
  });
  console.log(`Created extra dish: ${dish8.name}`);
  // ------------------------------------

  // 7. 创建一个离线的菜品用于测试筛选
  const dish6 = await prisma.dish.create({
    data: {
      name: '季节性烤鱼',
      tags: ['烧烤', '海鲜'],
      price: 35.0,
      priceUnit: '份',
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

  // 8. 创建待审核的菜品 (DishUpload)
  // 用户上传
  await prisma.dishUpload.create({
    data: {
      userId: user.id,
      name: '用户上传待审核菜品',
      tags: ['待审核'],
      price: 15.0,
      priceUnit: '份',
      description: '用户觉得好吃的菜',
      images: ['https://example.com/upload1.jpg'],
      ingredients: ['未知'],
      allergens: [],
      canteenId: canteen1.id,
      canteenName: canteen1.name,
      windowId: window1.id,
      windowNumber: window1.number,
      windowName: window1.name,
      availableMealTime: ['lunch'],
      status: 'pending',
    },
  });
  console.log(`Created pending user upload`);

  // 管理员上传
  await prisma.dishUpload.create({
    data: {
      adminId: admin.id,
      name: '管理员上传待审核菜品',
      tags: ['新品'],
      price: 25.0,
      priceUnit: '份',
      description: '即将推出的新品',
      images: ['https://example.com/upload2.jpg'],
      ingredients: ['高级食材'],
      allergens: [],
      canteenId: canteen1.id,
      canteenName: canteen1.name,
      windowId: window1.id,
      windowNumber: window1.number,
      windowName: window1.name,
      availableMealTime: ['dinner'],
      status: 'pending',
    },
  });
  console.log(`Created pending admin upload`);

  // 第二食堂的用户上传（用于测试食堂限制）
  await prisma.dishUpload.create({
    data: {
      userId: secondaryUser.id,
      name: '第二食堂用户上传待审核菜品',
      tags: ['待审核', '面食'],
      price: 18.0,
      priceUnit: '份',
      description: '第二食堂的面食',
      images: ['https://example.com/upload3.jpg'],
      ingredients: ['面粉', '牛肉'],
      allergens: ['面筋'],
      canteenId: canteen2.id,
      canteenName: canteen2.name,
      windowId: window3.id,
      windowNumber: window3.number,
      windowName: window3.name,
      availableMealTime: ['lunch', 'dinner'],
      status: 'pending',
    },
  });
  console.log(`Created pending user upload for canteen2`);

  // 已审核通过的上传记录（用于测试状态筛选）
  await prisma.dishUpload.create({
    data: {
      userId: user.id,
      name: '已通过审核的菜品',
      tags: ['已审核'],
      price: 20.0,
      priceUnit: '份',
      description: '这道菜已经通过审核',
      images: ['https://example.com/upload4.jpg'],
      ingredients: ['蔬菜'],
      allergens: [],
      canteenId: canteen1.id,
      canteenName: canteen1.name,
      windowId: window2.id,
      windowNumber: window2.number,
      windowName: window2.name,
      availableMealTime: ['lunch'],
      status: 'approved',
      approvedDishId: dish1.id,
    },
  });
  console.log(`Created approved upload`);

  // 已被拒绝的上传记录
  await prisma.dishUpload.create({
    data: {
      userId: secondaryUser.id,
      name: '被拒绝的菜品',
      tags: ['拒绝'],
      price: 30.0,
      priceUnit: '份',
      description: '这道菜被拒绝了',
      images: ['https://example.com/upload5.jpg'],
      ingredients: ['不明食材'],
      allergens: [],
      canteenId: canteen1.id,
      canteenName: canteen1.name,
      windowId: window1.id,
      windowNumber: window1.number,
      windowName: window1.name,
      availableMealTime: ['dinner'],
      status: 'rejected',
      rejectReason: '菜品信息不完整',
    },
  });
  console.log(`Created rejected upload`);

  // 9. 创建待审核评价数据（用于评价审核测试）
  const pendingReview1 = await prisma.review.create({
    data: {
      dishId: dish6.id,
      userId: user.id,
      rating: 5,
      content: '这道季节性烤鱼真的很好吃，期待下次供应！',
      images: ['https://example.com/review1.jpg'],
      status: 'pending',
    },
  });
  console.log(`Created pending review 1: ${pendingReview1.id}`);

  const pendingReview2 = await prisma.review.create({
    data: {
      dishId: dish2.id,
      userId: user.id,
      rating: 4,
      content: '清蒸鲈鱼很新鲜，就是价格有点贵。',
      images: [],
      status: 'pending',
    },
  });
  console.log(`Created pending review 2: ${pendingReview2.id}`);

  const pendingReview3 = await prisma.review.create({
    data: {
      dishId: dish8.id,
      userId: user.id,
      rating: 3,
      content: '地下炸鸡还行，酥脆可口。',
      images: ['https://example.com/review3.jpg'],
      status: 'pending',
    },
  });
  console.log(`Created pending review 3: ${pendingReview3.id}`);

  // --- 创建更多已审核通过的评价（用于测试菜品评价列表功能）---
  const approvedReview1 = await prisma.review.create({
    data: {
      dishId: dish1.id,
      userId: secondaryUser.id,
      rating: 5,
      content: '宫保鸡丁是我最喜欢的菜，每次来必点！',
      images: ['https://example.com/review_approved_1.jpg', 'https://example.com/review_approved_1_2.jpg'],
      status: 'approved',
      spicyLevel: 4,
      sweetness: 2,
      saltiness: 3,
      oiliness: 3,
    },
  });
  console.log(`Created approved review 1: ${approvedReview1.id}`);

  const approvedReview2 = await prisma.review.create({
    data: {
      dishId: dish1.id,
      userId: user.id,
      rating: 4,
      content: '味道不错，就是辣了一点。',
      images: [],
      status: 'approved',
      spicyLevel: 5,
      sweetness: 1,
      saltiness: 3,
      oiliness: 4,
    },
  });
  console.log(`Created approved review 2: ${approvedReview2.id}`);

  const approvedReview3 = await prisma.review.create({
    data: {
      dishId: dish2.id,
      userId: secondaryUser.id,
      rating: 5,
      content: '清蒸鲈鱼太棒了！鱼肉很嫩，很新鲜。',
      images: ['https://example.com/review_approved_3.jpg'],
      status: 'approved',
      spicyLevel: 0,
      sweetness: 1,
      saltiness: 2,
      oiliness: 1,
    },
  });
  console.log(`Created approved review 3: ${approvedReview3.id}`);

  const approvedReview4 = await prisma.review.create({
    data: {
      dishId: dish3.id,
      userId: user.id,
      rating: 4,
      content: '牛肉面的汤头很浓郁，牛肉炖得很烂。',
      images: [],
      status: 'approved',
      spicyLevel: 2,
      sweetness: 1,
      saltiness: 4,
      oiliness: 3,
    },
  });
  console.log(`Created approved review 4: ${approvedReview4.id}`);

  const approvedReview5 = await prisma.review.create({
    data: {
      dishId: dish4.id,
      userId: user.id,
      rating: 5,
      content: '麻婆豆腐太下饭了，麻辣鲜香，豆腐入味！',
      images: ['https://example.com/review_approved_5.jpg'],
      status: 'approved',
      spicyLevel: 5,
      sweetness: 1,
      saltiness: 4,
      oiliness: 4,
    },
  });
  console.log(`Created approved review 5: ${approvedReview5.id}`);

  const approvedReview6 = await prisma.review.create({
    data: {
      dishId: dish4.id,
      userId: secondaryUser.id,
      rating: 3,
      content: '麻婆豆腐味道还行，就是太辣了。',
      images: [],
      status: 'approved',
      spicyLevel: 5,
      sweetness: 0,
      saltiness: 4,
      oiliness: 4,
    },
  });
  console.log(`Created approved review 6: ${approvedReview6.id}`);

  const approvedReview7 = await prisma.review.create({
    data: {
      dishId: dish5.id,
      userId: user.id,
      rating: 4,
      content: '番茄炒蛋简单美味，适合配饭吃。',
      images: [],
      status: 'approved',
      spicyLevel: 0,
      sweetness: 3,
      saltiness: 2,
      oiliness: 2,
    },
  });
  console.log(`Created approved review 7: ${approvedReview7.id}`);

  const approvedReview8 = await prisma.review.create({
    data: {
      dishId: dish5.id,
      userId: secondaryUser.id,
      rating: 5,
      content: '番茄炒蛋做得很好，番茄酸甜可口。',
      images: ['https://example.com/review_approved_8.jpg'],
      status: 'approved',
    },
  });
  console.log(`Created approved review 8: ${approvedReview8.id}`);

  // 创建被拒绝的评价
  const rejectedReview1 = await prisma.review.create({
    data: {
      dishId: dish6.id,
      userId: secondaryUser.id,
      rating: 1,
      content: '这评价包含不当内容所以被拒绝了。',
      images: [],
      status: 'rejected',
      rejectReason: '评价内容包含不当言论',
    },
  });
  console.log(`Created rejected review 1: ${rejectedReview1.id}`);

  const rejectedReview2 = await prisma.review.create({
    data: {
      dishId: dish7.id,
      userId: user.id,
      rating: 2,
      content: '广告内容测试',
      images: [],
      status: 'rejected',
      rejectReason: '评价内容为广告',
    },
  });
  console.log(`Created rejected review 2: ${rejectedReview2.id}`);

  // 创建测试评价用于举报测试
  const testReviewForReport = await prisma.review.create({
    data: {
      dishId: dish3.id,
      userId: secondaryUser.id,
      rating: 1,
      content: '这是一条待举报的评价内容',
      status: 'approved',
    },
  });
  console.log(`Created test review for report: ${testReviewForReport.id}`);

  // 10. 创建测试评论用于举报测试
  const testCommentForReport = await prisma.comment.create({
    data: {
      reviewId: testReviewForReport.id,
      userId: secondaryUser.id,
      content: '这是一条待举报的评论内容',
      status: 'approved',
    },
  });
  console.log(`Created test comment for report: ${testCommentForReport.id}`);

  // --- 创建更多评论（用于测试评论列表功能）---
  // 对 approvedReview1 的评论
  const comment1 = await prisma.comment.create({
    data: {
      reviewId: approvedReview1.id,
      userId: user.id,
      content: '我也觉得宫保鸡丁很好吃！',
      floor: 1,
      status: 'approved',
    },
  });
  console.log(`Created comment 1: ${comment1.id}`);

  const comment2 = await prisma.comment.create({
    data: {
      reviewId: approvedReview1.id,
      userId: secondaryUser.id,
      content: '同意楼上的，这道菜确实不错。',
      floor: 2,
      status: 'approved',
    },
  });
  console.log(`Created comment 2: ${comment2.id}`);

  const comment3 = await prisma.comment.create({
    data: {
      reviewId: approvedReview1.id,
      userId: user.id,
      content: '今天去吃了，果然很好吃！',
      floor: 3,
      status: 'approved',
    },
  });
  console.log(`Created comment 3: ${comment3.id}`);

  // 带回复的评论（回复 comment1）
  const comment4 = await prisma.comment.create({
    data: {
      reviewId: approvedReview1.id,
      userId: secondaryUser.id,
      content: '回复楼上：我也觉得！',
      floor: 4,
      parentCommentId: comment1.id,
      status: 'approved',
    },
  });
  console.log(`Created reply comment 4: ${comment4.id}`);

  // 对 approvedReview2 的评论
  const comment5 = await prisma.comment.create({
    data: {
      reviewId: approvedReview2.id,
      userId: secondaryUser.id,
      content: '确实有点辣，不过我喜欢。',
      floor: 1,
      status: 'approved',
    },
  });
  console.log(`Created comment 5: ${comment5.id}`);

  // 对 approvedReview3 的评论
  const comment6 = await prisma.comment.create({
    data: {
      reviewId: approvedReview3.id,
      userId: user.id,
      content: '下次也试试这道鱼！',
      floor: 1,
      status: 'approved',
    },
  });
  console.log(`Created comment 6: ${comment6.id}`);

  const comment7 = await prisma.comment.create({
    data: {
      reviewId: approvedReview3.id,
      userId: secondaryUser.id,
      content: '强烈推荐！',
      floor: 2,
      status: 'approved',
    },
  });
  console.log(`Created comment 7: ${comment7.id}`);

  // 对 approvedReview4 的评论
  const comment8 = await prisma.comment.create({
    data: {
      reviewId: approvedReview4.id,
      userId: secondaryUser.id,
      content: '牛肉面是我的最爱！',
      floor: 1,
      status: 'approved',
    },
  });
  console.log(`Created comment 8: ${comment8.id}`);

  // 对 approvedReview5 的评论
  const comment9 = await prisma.comment.create({
    data: {
      reviewId: approvedReview5.id,
      userId: secondaryUser.id,
      content: '麻婆豆腐确实很下饭。',
      floor: 1,
      status: 'approved',
    },
  });
  console.log(`Created comment 9: ${comment9.id}`);

  const comment10 = await prisma.comment.create({
    data: {
      reviewId: approvedReview5.id,
      userId: user.id,
      content: '配一碗米饭刚刚好！',
      floor: 2,
      status: 'approved',
    },
  });
  console.log(`Created comment 10: ${comment10.id}`);

  // 待审核的评论
  const pendingComment1 = await prisma.comment.create({
    data: {
      reviewId: approvedReview1.id,
      userId: user.id,
      content: '这是一条待审核的评论内容',
      floor: 5,
      status: 'pending',
    },
  });
  console.log(`Created pending comment 1: ${pendingComment1.id}`);

  const pendingComment2 = await prisma.comment.create({
    data: {
      reviewId: approvedReview3.id,
      userId: secondaryUser.id,
      content: '另一条待审核评论',
      floor: 3,
      status: 'pending',
    },
  });
  console.log(`Created pending comment 2: ${pendingComment2.id}`);

  const pendingComment3 = await prisma.comment.create({
    data: {
      reviewId: approvedReview5.id,
      userId: user.id,
      content: '第三条待审核评论',
      floor: 3,
      status: 'pending',
    },
  });
  console.log(`Created pending comment 3: ${pendingComment3.id}`);

  // 被拒绝的评论
  const rejectedComment1 = await prisma.comment.create({
    data: {
      reviewId: approvedReview2.id,
      userId: secondaryUser.id,
      content: '这是被拒绝的评论',
      floor: 2,
      status: 'rejected',
      rejectReason: '评论内容包含广告',
    },
  });
  console.log(`Created rejected comment 1: ${rejectedComment1.id}`);

  // 11. 创建测试举报数据
  // 待处理的评价举报
  await prisma.report.create({
    data: {
      reporterId: user.id,
      targetType: 'review',
      targetId: testReviewForReport.id,
      reviewId: testReviewForReport.id,
      type: 'inappropriate',
      reason: '评价内容不当',
      status: 'pending',
    },
  });
  console.log(`Created pending review report`);

  // 待处理的评论举报
  await prisma.report.create({
    data: {
      reporterId: user.id,
      targetType: 'comment',
      targetId: testCommentForReport.id,
      commentId: testCommentForReport.id,
      type: 'spam',
      reason: '评论为垃圾信息',
      status: 'pending',
    },
  });
  console.log(`Created pending comment report`);

  // --- 新增更多待审核举报数据 ---
  // 待审核举报：评价类型 - inappropriate
  await prisma.report.create({
    data: {
      reporterId: secondaryUser.id,
      targetType: 'review',
      targetId: approvedReview1.id,
      reviewId: approvedReview1.id,
      type: 'inappropriate',
      reason: '评价内容有人身攻击',
      status: 'pending',
    },
  });
  console.log(`Created pending review report - inappropriate`);

  // 待审核举报：评价类型 - spam
  await prisma.report.create({
    data: {
      reporterId: user.id,
      targetType: 'review',
      targetId: approvedReview3.id,
      reviewId: approvedReview3.id,
      type: 'spam',
      reason: '评价内容为广告推广',
      status: 'pending',
    },
  });
  console.log(`Created pending review report - spam`);

  // 待审核举报：评价类型 - false_info
  await prisma.report.create({
    data: {
      reporterId: secondaryUser.id,
      targetType: 'review',
      targetId: approvedReview5.id,
      reviewId: approvedReview5.id,
      type: 'false_info',
      reason: '评价内容与事实不符',
      status: 'pending',
    },
  });
  console.log(`Created pending review report - false_info`);

  // 待审核举报：评价类型 - other
  await prisma.report.create({
    data: {
      reporterId: user.id,
      targetType: 'review',
      targetId: approvedReview6.id,
      reviewId: approvedReview6.id,
      type: 'other',
      reason: '其他原因：评价语气不友好',
      status: 'pending',
    },
  });
  console.log(`Created pending review report - other`);

  // 待审核举报：评论类型 - inappropriate
  await prisma.report.create({
    data: {
      reporterId: user.id,
      targetType: 'comment',
      targetId: comment1.id,
      commentId: comment1.id,
      type: 'inappropriate',
      reason: '评论内容不当',
      status: 'pending',
    },
  });
  console.log(`Created pending comment report - inappropriate`);

  // 待审核举报：评论类型 - spam
  await prisma.report.create({
    data: {
      reporterId: secondaryUser.id,
      targetType: 'comment',
      targetId: comment3.id,
      commentId: comment3.id,
      type: 'spam',
      reason: '评论为刷屏内容',
      status: 'pending',
    },
  });
  console.log(`Created pending comment report - spam`);

  // 待审核举报：评论类型 - false_info
  await prisma.report.create({
    data: {
      reporterId: user.id,
      targetType: 'comment',
      targetId: comment5.id,
      commentId: comment5.id,
      type: 'false_info',
      reason: '评论包含虚假信息',
      status: 'pending',
    },
  });
  console.log(`Created pending comment report - false_info`);

  // 待审核举报：评论类型 - other
  await prisma.report.create({
    data: {
      reporterId: secondaryUser.id,
      targetType: 'comment',
      targetId: comment8.id,
      commentId: comment8.id,
      type: 'other',
      reason: '其他原因举报',
      status: 'pending',
    },
  });
  console.log(`Created pending comment report - other`);

  // 待审核举报：更多评价举报
  await prisma.report.create({
    data: {
      reporterId: user.id,
      targetType: 'review',
      targetId: approvedReview7.id,
      reviewId: approvedReview7.id,
      type: 'spam',
      reason: '疑似机器人评价',
      status: 'pending',
    },
  });
  console.log(`Created pending review report - spam 2`);

  await prisma.report.create({
    data: {
      reporterId: secondaryUser.id,
      targetType: 'review',
      targetId: approvedReview8.id,
      reviewId: approvedReview8.id,
      type: 'inappropriate',
      reason: '评价图片不雅',
      status: 'pending',
    },
  });
  console.log(`Created pending review report - inappropriate 2`);

  // --- 已处理的举报 ---
  // 已处理的举报（用于测试筛选）
  await prisma.report.create({
    data: {
      reporterId: secondaryUser.id,
      targetType: 'review',
      targetId: testReviewForReport.id,
      reviewId: testReviewForReport.id,
      type: 'false_info',
      reason: '虚假信息',
      status: 'approved',
      handleResult: '内容已删除',
      handledBy: admin.id,
      handledAt: new Date(),
    },
  });
  console.log(`Created approved report`);

  // 更多已通过的举报
  await prisma.report.create({
    data: {
      reporterId: user.id,
      targetType: 'review',
      targetId: approvedReview2.id,
      reviewId: approvedReview2.id,
      type: 'inappropriate',
      reason: '评价内容涉及辱骂',
      status: 'approved',
      handleResult: '已删除评价内容',
      handledBy: admin.id,
      handledAt: new Date(),
    },
  });
  console.log(`Created approved report 2`);

  await prisma.report.create({
    data: {
      reporterId: secondaryUser.id,
      targetType: 'comment',
      targetId: comment2.id,
      commentId: comment2.id,
      type: 'spam',
      reason: '评论为广告',
      status: 'approved',
      handleResult: '已删除评论',
      handledBy: admin.id,
      handledAt: new Date(),
    },
  });
  console.log(`Created approved comment report`);

  // 被拒绝的举报
  await prisma.report.create({
    data: {
      reporterId: secondaryUser.id,
      targetType: 'comment',
      targetId: testCommentForReport.id,
      commentId: testCommentForReport.id,
      type: 'other',
      reason: '无效举报',
      status: 'rejected',
      handleResult: '举报理由不充分',
      handledBy: admin.id,
      handledAt: new Date(),
    },
  });
  console.log(`Created rejected report`);

  // 更多被拒绝的举报
  await prisma.report.create({
    data: {
      reporterId: user.id,
      targetType: 'review',
      targetId: approvedReview4.id,
      reviewId: approvedReview4.id,
      type: 'false_info',
      reason: '恶意举报',
      status: 'rejected',
      handleResult: '未发现违规内容',
      handledBy: admin.id,
      handledAt: new Date(),
    },
  });
  console.log(`Created rejected report 2`);

  await prisma.report.create({
    data: {
      reporterId: secondaryUser.id,
      targetType: 'comment',
      targetId: comment6.id,
      commentId: comment6.id,
      type: 'inappropriate',
      reason: '举报原因不明确',
      status: 'rejected',
      handleResult: '举报无效',
      handledBy: admin.id,
      handledAt: new Date(),
    },
  });
  console.log(`Created rejected comment report`);

  // ==================== K6 性能测试专用数据生成 ====================
  console.log('\n========== 开始生成 K6 性能测试专用数据 ==========\n');

  // K6-1: 批量生成更多在线菜品（用于菜品状态切换测试）
  const dishTemplates = [
    { name: '红烧肉', tags: ['家常菜', '猪肉'], price: 18, spicy: 1 },
    { name: '糖醋排骨', tags: ['家常菜', '猪肉'], price: 22, spicy: 0 },
    { name: '鱼香肉丝', tags: ['川菜', '猪肉'], price: 16, spicy: 3 },
    { name: '水煮牛肉', tags: ['川菜', '牛肉'], price: 28, spicy: 5 },
    { name: '干锅牛蛙', tags: ['川菜', '蛙类'], price: 38, spicy: 4 },
    { name: '蒜蓉西兰花', tags: ['素菜', '蔬菜'], price: 12, spicy: 0 },
    { name: '干煸四季豆', tags: ['家常菜', '素菜'], price: 14, spicy: 2 },
    { name: '酸辣土豆丝', tags: ['家常菜', '素菜'], price: 10, spicy: 3 },
    { name: '可乐鸡翅', tags: ['家常菜', '鸡肉'], price: 20, spicy: 0 },
    { name: '辣子鸡', tags: ['川菜', '鸡肉'], price: 26, spicy: 5 },
    { name: '青椒肉丝', tags: ['家常菜', '猪肉'], price: 15, spicy: 1 },
    { name: '回锅肉', tags: ['川菜', '猪肉'], price: 18, spicy: 3 },
    { name: '醋溜白菜', tags: ['家常菜', '素菜'], price: 8, spicy: 0 },
    { name: '地三鲜', tags: ['东北菜', '素菜'], price: 14, spicy: 0 },
    { name: '锅包肉', tags: ['东北菜', '猪肉'], price: 24, spicy: 0 },
  ];

  const k6Dishes: any[] = [];
  const windowsForK6 = [window1, window2, window3];
  const floorsForK6 = [floor1, floor2];
  const canteensForK6 = [canteen1, canteen2];

  for (let i = 0; i < Math.min(K6_CONFIG.ONLINE_DISHES, dishTemplates.length); i++) {
    const template = dishTemplates[i];
    const windowIndex = i % windowsForK6.length;
    const selectedWindow = windowsForK6[windowIndex];
    const selectedCanteen = windowIndex < 2 ? canteen1 : canteen2;
    const selectedFloor = windowIndex < 2 ? floor1 : floor2;

    const dish = await prisma.dish.create({
      data: {
        name: `[K6] ${template.name}`,
        tags: template.tags,
        price: template.price,
        priceUnit: '份',
        description: `K6性能测试用菜品 - ${template.name}`,
        images: [`https://example.com/k6_dish_${i + 1}.jpg`],
        ingredients: ['食材1', '食材2', '食材3'],
        allergens: [],
        spicyLevel: template.spicy,
        sweetness: 2,
        saltiness: 3,
        oiliness: 3,
        canteenId: selectedCanteen.id,
        canteenName: selectedCanteen.name,
        floorId: selectedFloor.id,
        floorLevel: selectedFloor.level,
        floorName: selectedFloor.name,
        windowId: selectedWindow.id,
        windowNumber: selectedWindow.number,
        windowName: selectedWindow.name,
        availableMealTime: ['lunch', 'dinner'],
        status: 'online', // 重要：用于状态切换测试
        averageRating: 4.0 + Math.random() * 0.8,
        reviewCount: Math.floor(Math.random() * 100) + 10,
      },
    });
    k6Dishes.push(dish);
  }
  console.log(`[K6] Created ${k6Dishes.length} online dishes for status toggle testing`);

  // K6-2: 批量生成更多待审核的上传菜品（用于上传审核测试）
  const uploadTemplates = [
    '新品炒饭', '特色盖饭', '秘制拌面', '招牌汤面', '营养套餐',
    '精品小炒', '养生粥品', '特色小吃', '时令蔬菜', '滋补汤品',
    '手工水饺', '鲜肉包子', '葱油饼', '煎饺', '馄饨',
  ];

  for (let i = 0; i < K6_CONFIG.PENDING_UPLOADS; i++) {
    const uploadName = uploadTemplates[i % uploadTemplates.length];
    const isUserUpload = i % 2 === 0;
    const selectedUser = isUserUpload ? (i % 4 === 0 ? user : secondaryUser) : null;
    const selectedAdmin = isUserUpload ? null : admin;
    const selectedCanteen = i % 2 === 0 ? canteen1 : canteen2;
    const selectedWindow = windowsForK6[i % windowsForK6.length];

    await prisma.dishUpload.create({
      data: {
        userId: selectedUser?.id,
        adminId: selectedAdmin?.id,
        name: `[K6] ${uploadName} #${i + 1}`,
        tags: ['待审核', 'K6测试'],
        price: 10 + Math.floor(Math.random() * 20),
        priceUnit: '份',
        description: `K6性能测试用待审核上传 #${i + 1}`,
        images: [`https://example.com/k6_upload_${i + 1}.jpg`],
        ingredients: ['配料1', '配料2'],
        allergens: [],
        canteenId: selectedCanteen.id,
        canteenName: selectedCanteen.name,
        windowId: selectedWindow.id,
        windowNumber: selectedWindow.number,
        windowName: selectedWindow.name,
        availableMealTime: ['lunch', 'dinner'],
        status: 'pending', // 关键：待审核状态
      },
    });
  }
  console.log(`[K6] Created ${K6_CONFIG.PENDING_UPLOADS} pending dish uploads for audit testing`);

  // K6-3: 批量生成更多待审核的评价（用于评价审核测试）
  const allDishes = [...k6Dishes, dish1, dish2, dish3, dish4, dish5];
  const users = [user, secondaryUser];
  const reviewContents = [
    '这道菜味道非常好，推荐大家尝试！',
    '性价比很高，量也足够。',
    '口感不错，下次还会再来。',
    '味道一般，可以改进。',
    '服务态度好，菜品也很新鲜。',
    '等待时间有点长，但味道值得。',
    '价格合理，味道正宗。',
    '食材新鲜，烹饪得当。',
    '分量很足，吃得很饱。',
    '调味恰到好处，非常满意。',
    '这是我吃过最好吃的菜之一！',
    '环境整洁，菜品卫生。',
  ];

  const k6Reviews: any[] = [];
  for (let i = 0; i < K6_CONFIG.PENDING_REVIEWS; i++) {
    const selectedDish = allDishes[i % allDishes.length];
    const selectedUser = users[i % users.length];
    const content = reviewContents[i % reviewContents.length];

    try {
      const review = await prisma.review.create({
        data: {
          dishId: selectedDish.id,
          userId: selectedUser.id,
          rating: Math.floor(Math.random() * 3) + 3, // 3-5分
          content: `[K6] ${content} (#${i + 1})`,
          images: i % 3 === 0 ? [`https://example.com/k6_review_${i + 1}.jpg`] : [],
          status: 'pending', // 关键：待审核状态
          spicyLevel: Math.floor(Math.random() * 5) + 1,
          sweetness: Math.floor(Math.random() * 5) + 1,
          saltiness: Math.floor(Math.random() * 5) + 1,
          oiliness: Math.floor(Math.random() * 5) + 1,
        },
      });
      k6Reviews.push(review);
    } catch (e) {
      // 跳过重复的 userId+dishId 组合
      console.log(`[K6] Skipped duplicate review for dish ${selectedDish.name}`);
    }
  }
  console.log(`[K6] Created ${k6Reviews.length} pending reviews for review audit testing`);

  // K6-4: 批量生成更多待审核的评论（用于评论审核测试）
  const allReviews = [...k6Reviews, approvedReview1, approvedReview2, approvedReview3, approvedReview4, approvedReview5];
  const commentContents = [
    '同意楼主的评价！',
    '我也觉得这道菜不错。',
    '下次一起去吃吧！',
    '这个推荐很有用，谢谢！',
    '请问这道菜辣吗？',
    '今天去试了，确实好吃。',
    '性价比真的高！',
    '已经吃过了，味道棒！',
    '求推荐其他好吃的菜。',
    '这家窗口的菜都不错。',
    '第一次来，感觉很好。',
    '常客了，一直很稳定。',
  ];

  let k6CommentCount = 0;
  let floorCounter: { [key: string]: number } = {};
  for (let i = 0; i < K6_CONFIG.PENDING_COMMENTS; i++) {
    const selectedReview = allReviews[i % allReviews.length];
    if (!selectedReview) continue;
    
    const selectedUser = users[i % users.length];
    const content = commentContents[i % commentContents.length];
    
    // 跟踪每个评价的楼层
    if (!floorCounter[selectedReview.id]) {
      floorCounter[selectedReview.id] = 10; // 从10楼开始，避免和现有评论冲突
    }
    floorCounter[selectedReview.id]++;

    await prisma.comment.create({
      data: {
        reviewId: selectedReview.id,
        userId: selectedUser.id,
        content: `[K6] ${content} (#${i + 1})`,
        floor: floorCounter[selectedReview.id],
        status: 'pending', // 关键：待审核状态
      },
    });
    k6CommentCount++;
  }
  console.log(`[K6] Created ${k6CommentCount} pending comments for comment audit testing`);

  // K6-5: 批量生成更多待处理的举报（用于举报处理测试）
  const reportTypes = ['inappropriate', 'spam', 'false_info', 'other'] as const;
  const reportReasons = {
    inappropriate: ['内容不当', '包含辱骂', '攻击性语言', '不良信息'],
    spam: ['广告内容', '刷屏', '垃圾信息', '机器人'],
    false_info: ['虚假信息', '与事实不符', '误导消费者', '虚假宣传'],
    other: ['其他原因', '需要人工判断', '疑似违规', '待确认'],
  };

  for (let i = 0; i < K6_CONFIG.PENDING_REPORTS; i++) {
    const isReviewReport = i % 2 === 0;
    const reportType = reportTypes[i % reportTypes.length];
    const reasons = reportReasons[reportType];
    const reason = reasons[i % reasons.length];
    const reporter = users[i % users.length];

    if (isReviewReport) {
      const targetReview = allReviews[i % allReviews.length];
      if (!targetReview) continue;
      
      await prisma.report.create({
        data: {
          reporterId: reporter.id,
          targetType: 'review',
          targetId: targetReview.id,
          reviewId: targetReview.id,
          type: reportType,
          reason: `[K6] ${reason} (#${i + 1})`,
          status: 'pending', // 关键：待处理状态
        },
      });
    } else {
      // 评论举报 - 使用已有的评论
      const existingComments = [comment1, comment2, comment3, comment5, comment6, comment7, comment8, comment9, comment10];
      const targetComment = existingComments[i % existingComments.length];
      if (!targetComment) continue;

      await prisma.report.create({
        data: {
          reporterId: reporter.id,
          targetType: 'comment',
          targetId: targetComment.id,
          commentId: targetComment.id,
          type: reportType,
          reason: `[K6] ${reason} (#${i + 1})`,
          status: 'pending', // 关键：待处理状态
        },
      });
    }
  }
  console.log(`[K6] Created ${K6_CONFIG.PENDING_REPORTS} pending reports for moderation testing`);

  console.log('\n========== K6 性能测试数据生成完成 ==========');
  console.log(`
📊 数据统计摘要：
  - 在线菜品 (status=online): ${k6Dishes.length + 7} 条
  - 待审核上传 (status=pending): ${K6_CONFIG.PENDING_UPLOADS + 3} 条
  - 待审核评价 (status=pending): ${k6Reviews.length + 3} 条
  - 待审核评论 (status=pending): ${k6CommentCount + 3} 条
  - 待处理举报 (status=pending): ${K6_CONFIG.PENDING_REPORTS + 12} 条

🔑 K6 测试账号：
  - 用户名: ${k6Admin.username}
  - 密码: ${k6AdminPassword}
  - 角色: superadmin (拥有所有权限)
`);

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
