// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

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
