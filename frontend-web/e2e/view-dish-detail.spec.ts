import { test, expect } from '@playwright/test';
import { loginAsAdmin, getApiToken, TEST_ACCOUNTS, API_BASE_URL } from './utils';

// API base URL for direct API calls
const baseURL = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;

/**
 * View Dish Detail E2E Tests
 * 
 * Tests for the ViewDishDetail.vue page that displays dish information and reviews
 */
test.describe('View Dish Detail', () => {
  let testDishId: string | null = null;
  let superAdminToken: string | null = null;

  test.beforeAll(async ({ request }) => {
    // Get super admin token
    superAdminToken = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(superAdminToken).toBeTruthy();

    // Create a test dish for viewing
    const dishName = `E2E View Test Dish ${Date.now()}`;
    const createResponse = await request.post(`${baseURL}admin/dishes`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
      data: {
        name: dishName,
        price: 25.5,
        canteenName: '第一食堂',
        windowName: '川菜窗口',
        description: 'E2E test dish for viewing',
        tags: ['川菜', '辣'],
        spicyLevel: 3,
        saltiness: 2,
        sweetness: 1,
        oiliness: 2,
        availableMealTime: ['lunch', 'dinner'],
      },
    });

    if (createResponse.ok()) {
      const createData = await createResponse.json();
      const uploadId = createData.data.id;

      // Approve the dish
      await request.post(`${baseURL}admin/dishes/uploads/${uploadId}/approve`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });

      // Wait for dish to be available
      let found = false;
      for (let i = 0; i < 10; i++) {
        const dishesResp = await request.get(`${baseURL}admin/dishes?pageSize=100`, {
          headers: { Authorization: `Bearer ${superAdminToken}` },
        });
        if (dishesResp.ok()) {
          const dishes = await dishesResp.json();
          const dish = dishes.data.items.find((d: any) => d.name === dishName);
          if (dish) {
            testDishId = dish.id;
            found = true;
            break;
          }
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      expect(found).toBeTruthy();
    }
  });

  test.afterAll(async ({ request }) => {
    // Cleanup test dish
    if (testDishId && superAdminToken) {
      try {
        await request.delete(`${baseURL}admin/dishes/${testDishId}`, {
          headers: { Authorization: `Bearer ${superAdminToken}` },
        });
      } catch (e) {
        console.warn('Failed to cleanup test dish:', e);
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should display dish detail page correctly', async ({ page }) => {
    test.skip(!testDishId, 'Test dish not created');

    await page.goto(`/view-dish/${testDishId}`);
    await page.waitForLoadState('networkidle');

    // Verify page header
    await expect(page.locator('h2:has-text("菜品详情")')).toBeVisible();
    await expect(page.locator('text=查看菜品信息和评论')).toBeVisible();

    // Verify close button
    await expect(page.locator('button[title="关闭"]')).toBeVisible();
  });

  test('should display all dish information sections', async ({ page }) => {
    test.skip(!testDishId, 'Test dish not created');

    await page.goto(`/view-dish/${testDishId}`);
    await page.waitForLoadState('networkidle');

    // Verify all main sections
    await expect(page.locator('label:has-text("食堂信息")')).toBeVisible();
    await expect(page.locator('label:has-text("窗口信息")')).toBeVisible();
    await expect(page.locator('label:has-text("菜品名称")')).toBeVisible();
    await expect(page.locator('label:has-text("菜品价格（元）")')).toBeVisible();
    await expect(page.locator('label:has-text("菜品描述")')).toBeVisible();
    await expect(page.locator('label:has-text("菜品图片")')).toBeVisible();
    await expect(page.locator('label:has-text("菜品子项")')).toBeVisible();
    await expect(page.locator('label:has-text("供应信息")')).toBeVisible();
    await expect(page.locator('label:has-text("供应时间")')).toBeVisible();
    await expect(page.locator('label:has-text("过敏原")')).toBeVisible();
    await expect(page.locator('label:has-text("原辅料")')).toBeVisible();
  });

  test('should display dish basic information', async ({ page }) => {
    test.skip(!testDishId, 'Test dish not created');

    await page.goto(`/view-dish/${testDishId}`);
    await page.waitForLoadState('networkidle');

    // Verify dish name is displayed
    await expect(page.locator('text=E2E View Test Dish')).toBeVisible();

    // Verify price is displayed
    await expect(page.locator('text=¥25.50')).toBeVisible();

    // Verify description is displayed
    await expect(page.locator('text=E2E test dish for viewing')).toBeVisible();
  });

  test('should display tags and taste indicators', async ({ page }) => {
    test.skip(!testDishId, 'Test dish not created');

    await page.goto(`/view-dish/${testDishId}`);
    await page.waitForLoadState('networkidle');

    // Verify tags are displayed
    await expect(page.locator('text=#川菜')).toBeVisible();
    await expect(page.locator('text=#辣')).toBeVisible();

    // Verify taste indicators
    await expect(page.locator('label:has-text("辣度")')).toBeVisible();
    await expect(page.locator('label:has-text("咸度")')).toBeVisible();
    await expect(page.locator('label:has-text("甜度")')).toBeVisible();
    await expect(page.locator('label:has-text("油度")')).toBeVisible();
  });

  test('should display available meal times', async ({ page }) => {
    test.skip(!testDishId, 'Test dish not created');

    await page.goto(`/view-dish/${testDishId}`);
    await page.waitForLoadState('networkidle');

    // Verify meal time labels
    await expect(page.locator('text=早餐')).toBeVisible();
    await expect(page.locator('text=午餐')).toBeVisible();
    await expect(page.locator('text=晚餐')).toBeVisible();
    await expect(page.locator('text=夜宵')).toBeVisible();
  });

  test('should display reviews section', async ({ page }) => {
    test.skip(!testDishId, 'Test dish not created');

    await page.goto(`/view-dish/${testDishId}`);
    await page.waitForLoadState('networkidle');

    // Verify reviews section header
    await expect(page.locator('h3:has-text("菜品评论")')).toBeVisible();

    // Verify review filter dropdown
    await expect(page.locator('select')).toBeVisible();
    await expect(page.locator('option:has-text("全部")')).toBeVisible();
    await expect(page.locator('option:has-text("待审核")')).toBeVisible();
    await expect(page.locator('option:has-text("已通过")')).toBeVisible();
    await expect(page.locator('option:has-text("已拒绝")')).toBeVisible();
  });

  test('should filter reviews by status', async ({ page }) => {
    test.skip(!testDishId, 'Test dish not created');

    await page.goto(`/view-dish/${testDishId}`);
    await page.waitForLoadState('networkidle');

    // Select filter
    const filterSelect = page.locator('select');
    await filterSelect.selectOption('pending');

    // Wait for filter to apply
    await page.waitForTimeout(1000);

    // Verify filter is applied (the select should have the selected value)
    await expect(filterSelect).toHaveValue('pending');
  });

  test('should navigate back when clicking close button', async ({ page }) => {
    test.skip(!testDishId, 'Test dish not created');

    await page.goto(`/view-dish/${testDishId}`);
    await page.waitForLoadState('networkidle');

    // Click close button
    await page.click('button[title="关闭"]');

    // Should navigate back to modify-dish page
    await page.waitForURL(/\/modify-dish/);
  });

  test('should handle empty sub-items display', async ({ page }) => {
    test.skip(!testDishId, 'Test dish not created');

    await page.goto(`/view-dish/${testDishId}`);
    await page.waitForLoadState('networkidle');

    // Verify sub-items section exists
    await expect(page.locator('label:has-text("菜品子项")')).toBeVisible();

    // If no sub-items, should show "暂无子项"
    const noSubItems = await page.locator('text=暂无子项').isVisible();
    const hasSubItems = await page.locator('.flex.items-center.justify-between').first().isVisible();

    // Either should be true
    expect(noSubItems || hasSubItems).toBeTruthy();
  });

  test('should handle pagination in reviews section', async ({ page }) => {
    test.skip(!testDishId, 'Test dish not created');

    await page.goto(`/view-dish/${testDishId}`);
    await page.waitForLoadState('networkidle');

    // Wait for reviews to load
    await page.waitForTimeout(2000);

    // Check if pagination exists (only if there are multiple pages)
    const paginationVisible = await page.locator('text=上一页').isVisible();
    
    if (paginationVisible) {
      // Verify pagination controls
      await expect(page.locator('button:has-text("上一页")')).toBeVisible();
      await expect(page.locator('button:has-text("下一页")')).toBeVisible();
    }
  });

  test('should display empty state when no reviews', async ({ page }) => {
    test.skip(!testDishId, 'Test dish not created');

    await page.goto(`/view-dish/${testDishId}`);
    await page.waitForLoadState('networkidle');

    // Wait for reviews section to load
    await page.waitForTimeout(2000);

    // Check for either reviews or empty state
    const hasReviews = await page.locator('.border.rounded-lg.p-4').first().isVisible();
    const hasEmptyState = await page.locator('text=暂无评论').isVisible();

    expect(hasReviews || hasEmptyState).toBeTruthy();
  });

  test('should handle image display when images exist', async ({ page }) => {
    test.skip(!testDishId, 'Test dish not created');

    await page.goto(`/view-dish/${testDishId}`);
    await page.waitForLoadState('networkidle');

    // Check for either images or no images state
    const hasImages = await page.locator('img[alt="菜品图片"]').isVisible();
    const hasNoImages = await page.locator('text=暂无图片').isVisible();

    expect(hasImages || hasNoImages).toBeTruthy();
  });
});

/**
 * View Dish Detail API Tests
 */
test.describe('View Dish Detail API Tests', () => {
  test('should get dish detail via API', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    // Get a dish ID first
    const dishesResponse = await request.get(`${baseURL}admin/dishes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(dishesResponse.ok()).toBeTruthy();
    const dishes = await dishesResponse.json();
    
    if (dishes.data.items.length === 0) {
      test.skip();
      return;
    }

    const dishId = dishes.data.items[0].id;

    // Get dish detail
    const response = await request.get(`${baseURL}admin/dishes/${dishId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.code).toBe(200);
    expect(data.data).toBeDefined();
    expect(data.data.id).toBe(dishId);
    expect(data.data.name).toBeDefined();
  });

  test('should get dish reviews via API', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    // Get a dish ID first
    const dishesResponse = await request.get(`${baseURL}admin/dishes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(dishesResponse.ok()).toBeTruthy();
    const dishes = await dishesResponse.json();
    
    if (dishes.data.items.length === 0) {
      test.skip();
      return;
    }

    const dishId = dishes.data.items[0].id;

    // Get dish reviews
    const response = await request.get(`${baseURL}dishes/${dishId}/reviews`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page: 1, pageSize: 10 },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.code).toBe(200);
    expect(data.data).toBeDefined();
    expect(data.data.items).toBeInstanceOf(Array);
    expect(data.data.meta).toBeDefined();
  });

  test('should return 404 for non-existent dish', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    const response = await request.get(`${baseURL}admin/dishes/non-existent-id`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(404);
  });

  test('should return 401 without token', async ({ request }) => {
    const response = await request.get(`${baseURL}admin/dishes/some-id`);
    expect(response.status()).toBe(401);
  });
});

