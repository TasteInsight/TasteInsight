import { test, expect, request } from '@playwright/test';
import { loginAsAdmin, getApiToken, TEST_ACCOUNTS } from './utils';

// API base URL for direct API calls
const baseURL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/';

test.describe('Admin Dish Management', () => {
  let createdDishId: string;

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.afterEach(async ({ request }) => {
    if (createdDishId) {
      try {
        // Login to get token
        const loginResponse = await request.post(`${baseURL}auth/admin/login`, {
          data: {
            username: process.env.TEST_ADMIN_USERNAME || 'testadmin',
            password: process.env.TEST_ADMIN_PASSWORD || 'password123'
          }
        });

        if (loginResponse.ok()) {
          const loginData = await loginResponse.json();
          const token = loginData.data.token.accessToken;

          // Delete the dish
          await request.delete(`${baseURL}admin/dishes/${createdDishId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
        }
      } catch (error) {
        console.warn('Failed to clean up test dish:', error);
      }
    }
  });

  test('Create, Approve, Edit, and Delete (API) Dish', async ({ page }) => {
    const dishName = `E2E Test Dish ${Date.now()}`;
    const dishPrice = '15.5';
    const dishDescription = 'This is a test dish created by Playwright E2E test.';

    // 1. Create a new dish
    await page.goto('/single-add');
    
    // Select Canteen
    await page.waitForSelector('select', { state: 'visible' });
    const canteenSelect = page.locator('select').first();
    
    // Try to select by label if possible, assuming "第一食堂" exists
    const canteenOptions = await canteenSelect.locator('option').allInnerTexts();
    if (canteenOptions.some(opt => opt.includes('第一食堂'))) {
        await canteenSelect.selectOption({ label: '第一食堂' });
    } else {
        await canteenSelect.selectOption({ index: 1 });
    }

    // Select Window
    const windowSelect = page.locator('select').nth(1);
    await expect(windowSelect).toBeEnabled();
    // Try to select "川菜窗口" if available (from seed), otherwise fallback to index
    const windowOptions = await windowSelect.locator('option').allInnerTexts();
    if (windowOptions.some(opt => opt.includes('川菜窗口'))) {
        await windowSelect.selectOption({ label: '川菜窗口' });
    } else {
        await windowSelect.selectOption({ index: 1 });
    }

    // Fill Name
    await page.fill('input[placeholder="例如：水煮肉片"]', dishName);

    // Fill Price
    await page.fill('input[type="number"][placeholder*="15.00"]', dishPrice);

    // Fill Description
    await page.fill('textarea[placeholder="请输入菜品描述..."]', dishDescription);

    // Handle success alert
    page.once('dialog', async dialog => {
      await dialog.accept();
    });

    // Submit
    await page.click('button:has-text("保存菜品信息")');

    // Wait for navigation to edit page which confirms creation
    await page.waitForURL(/\/edit-dish\/.*/);

    // 2. Approve the dish in ReviewDish page
    await page.goto('/review-dish');
    
    // Search for the dish
    await page.fill('input[placeholder="搜索菜品名称..."]', dishName);
    
    // Wait for the row to appear
    const reviewRow = page.locator('tr', { hasText: dishName });
    await expect(reviewRow).toBeVisible({ timeout: 10000 });

    // Click "审核" button
    const reviewButton = reviewRow.locator('button:has-text("审核")');
    await reviewButton.click();

    // Wait for navigation to detail page
    await page.waitForURL(/\/review-dish\/.*/);

    // Handle confirm dialog for approval
    page.once('dialog', async dialog => {
      await dialog.accept();
    });

    // Click "批准通过" button
    await page.click('button:has-text("批准通过")');

    // Wait for navigation back to review list
    await page.waitForURL(/\/review-dish/);

    // 3. Verify the dish exists in the ModifyDish list
    await page.goto('/modify-dish');
    
    // Search for the dish
    await page.fill('input[placeholder="搜索菜品名称、食堂、窗口..."]', dishName);
    
    // Wait for the table to contain the dish name
    await expect(page.locator('table')).toContainText(dishName, { timeout: 10000 });
    await expect(page.locator('table')).toContainText(dishPrice);

    // 4. Verify Edit Button works and capture ID
    const row = page.locator('tr', { hasText: dishName });
    const editButton = row.locator('button[title="编辑"]');
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Verify navigation to edit page
    await page.waitForURL(/\/edit-dish\/.*/);
    
    // Extract ID from URL for cleanup
    const url = page.url();
    const match = url.match(/\/edit-dish\/(.+)/);
    if (match && match[1]) {
      createdDishId = match[1];
    }
  });
});

/**
 * Permission Control Tests - Using API directly
 * These tests verify that permission controls work correctly
 */
test.describe('Admin Dish Permission Control (API)', () => {
  test('normalAdmin (view only) should be able to GET dishes', async ({ request }) => {
    const token = await getApiToken(request, TEST_ACCOUNTS.normalAdmin.username, TEST_ACCOUNTS.normalAdmin.password);
    expect(token).toBeTruthy();
    
    const response = await request.get(`${baseURL}admin/dishes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.code).toBe(200);
    expect(data.data.items).toBeDefined();
  });

  test('normalAdmin (view only) should NOT be able to POST (create) dishes', async ({ request }) => {
    const token = await getApiToken(request, TEST_ACCOUNTS.normalAdmin.username, TEST_ACCOUNTS.normalAdmin.password);
    expect(token).toBeTruthy();
    
    const response = await request.post(`${baseURL}admin/dishes`, {
      headers: { 'Authorization': `Bearer ${token}` },
      data: {
        name: 'Test Dish - Should Fail',
        price: 15.0,
        canteenName: '第一食堂',
        windowName: '川菜窗口'
      }
    });
    
    // Should get 403 Forbidden
    expect(response.status()).toBe(403);
  });

  test('normalAdmin (view only) should NOT be able to PUT (edit) dishes', async ({ request }) => {
    // First get a dish ID using super admin
    const superToken = await getApiToken(request, TEST_ACCOUNTS.superAdmin.username, TEST_ACCOUNTS.superAdmin.password);
    const dishesResponse = await request.get(`${baseURL}admin/dishes`, {
      headers: { 'Authorization': `Bearer ${superToken}` }
    });
    const dishes = await dishesResponse.json();
    
    // Ensure test data exists - this test requires at least one dish in the database
    if (!dishes.data.items || dishes.data.items.length === 0) {
      throw new Error('Test requires at least one dish in seed data');
    }
    const testDishId = dishes.data.items[0].id;
    expect(testDishId).toBeTruthy();

    // Now try to edit with normalAdmin
    const token = await getApiToken(request, TEST_ACCOUNTS.normalAdmin.username, TEST_ACCOUNTS.normalAdmin.password);
    expect(token).toBeTruthy();
    
    const response = await request.put(`${baseURL}admin/dishes/${testDishId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      data: { name: 'Modified Name - Should Fail' }
    });
    
    // Should get 403 Forbidden
    expect(response.status()).toBe(403);
  });

  test('normalAdmin (view only) should NOT be able to DELETE dishes', async ({ request }) => {
    // First get a dish ID using super admin
    const superToken = await getApiToken(request, TEST_ACCOUNTS.superAdmin.username, TEST_ACCOUNTS.superAdmin.password);
    const dishesResponse = await request.get(`${baseURL}admin/dishes`, {
      headers: { 'Authorization': `Bearer ${superToken}` }
    });
    const dishes = await dishesResponse.json();
    const testDishId = dishes.data.items[0]?.id;
    expect(testDishId).toBeTruthy();

    // Now try to delete with normalAdmin
    const token = await getApiToken(request, TEST_ACCOUNTS.normalAdmin.username, TEST_ACCOUNTS.normalAdmin.password);
    expect(token).toBeTruthy();
    
    const response = await request.delete(`${baseURL}admin/dishes/${testDishId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    // Should get 403 Forbidden
    expect(response.status()).toBe(403);
  });

  test('limitedAdmin (view+edit) should be able to GET dishes', async ({ request }) => {
    const token = await getApiToken(request, TEST_ACCOUNTS.limitedAdmin.username, TEST_ACCOUNTS.limitedAdmin.password);
    expect(token).toBeTruthy();
    
    const response = await request.get(`${baseURL}admin/dishes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.code).toBe(200);
  });

  test('limitedAdmin (view+edit) should be able to PUT (edit) dishes', async ({ request }) => {
    // First get a dish ID using super admin
    const superToken = await getApiToken(request, TEST_ACCOUNTS.superAdmin.username, TEST_ACCOUNTS.superAdmin.password);
    const dishesResponse = await request.get(`${baseURL}admin/dishes`, {
      headers: { 'Authorization': `Bearer ${superToken}` }
    });
    const dishes = await dishesResponse.json();
    const testDishId = dishes.data.items[0]?.id;
    expect(testDishId).toBeTruthy();

    // Now try to edit with limitedAdmin
    const token = await getApiToken(request, TEST_ACCOUNTS.limitedAdmin.username, TEST_ACCOUNTS.limitedAdmin.password);
    expect(token).toBeTruthy();
    
    const response = await request.put(`${baseURL}admin/dishes/${testDishId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      data: { description: 'Updated by limitedAdmin' }
    });
    
    // Should succeed with 200
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.code).toBe(200);
  });

  test('limitedAdmin (view+edit) should NOT be able to DELETE dishes', async ({ request }) => {
    // First get a dish ID using super admin
    const superToken = await getApiToken(request, TEST_ACCOUNTS.superAdmin.username, TEST_ACCOUNTS.superAdmin.password);
    const dishesResponse = await request.get(`${baseURL}admin/dishes`, {
      headers: { 'Authorization': `Bearer ${superToken}` }
    });
    const dishes = await dishesResponse.json();
    const testDishId = dishes.data.items[0]?.id;
    expect(testDishId).toBeTruthy();

    // Now try to delete with limitedAdmin
    const token = await getApiToken(request, TEST_ACCOUNTS.limitedAdmin.username, TEST_ACCOUNTS.limitedAdmin.password);
    expect(token).toBeTruthy();
    
    const response = await request.delete(`${baseURL}admin/dishes/${testDishId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    // Should get 403 Forbidden
    expect(response.status()).toBe(403);
  });

  test('superAdmin should be able to perform all operations', async ({ request }) => {
    const token = await getApiToken(request, TEST_ACCOUNTS.superAdmin.username, TEST_ACCOUNTS.superAdmin.password);
    expect(token).toBeTruthy();
    
    // Create
    const createResponse = await request.post(`${baseURL}admin/dishes`, {
      headers: { 'Authorization': `Bearer ${token}` },
      data: {
        name: `E2E Permission Test Dish ${Date.now()}`,
        price: 18.0,
        canteenName: '第一食堂',
        windowName: '川菜窗口',
        description: 'Created by superAdmin permission test'
      }
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    expect(createData.code).toBe(201);
    const dishUploadId = createData.data.id;

    // Note: The created dish is in DishUpload (pending), not Dish yet
    // Let's test with an existing dish for update
    const dishesResponse = await request.get(`${baseURL}admin/dishes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const dishes = await dishesResponse.json();
    const existingDishId = dishes.data.items[0]?.id;
    
    if (existingDishId) {
      // Update
      const updateResponse = await request.put(`${baseURL}admin/dishes/${existingDishId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        data: { description: 'Updated by superAdmin permission test' }
      });
      expect(updateResponse.status()).toBe(200);
    }

    // Clean up the created dish upload
    try {
      await request.delete(`${baseURL}admin/uploads/${dishUploadId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      // Ignore cleanup errors
    }
  });
});

/**
 * Canteen Admin Permission Tests - Scoped access
 */
test.describe('Canteen Admin Scoped Access (API)', () => {
  test('canteenAdmin should only see dishes from their canteen', async ({ request }) => {
    const token = await getApiToken(request, TEST_ACCOUNTS.canteenAdmin.username, TEST_ACCOUNTS.canteenAdmin.password);
    expect(token).toBeTruthy();
    
    const response = await request.get(`${baseURL}admin/dishes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.code).toBe(200);
    
    // Verify dishes exist and all belong to the same canteen (第一食堂)
    const dishes = data.data.items;
    
    // canteenAdmin should see at least one dish from their canteen
    expect(dishes.length).toBeGreaterThan(0);
    
    // Get the canteenId from the first dish (should be 第一食堂)
    const expectedCanteenId = dishes[0].canteenId;
    expect(expectedCanteenId).toBeTruthy();
    
    // All dishes should belong to the same canteen
    dishes.forEach((dish: any) => {
      expect(dish.canteenId).toBe(expectedCanteenId);
    });
    
    // Verify canteen name is 第一食堂 (if canteenName is available in response)
    if (dishes[0].canteenName) {
      expect(dishes[0].canteenName).toBe('第一食堂');
    }
  });

  test('canteenAdmin should NOT be able to create dish for other canteen', async ({ request }) => {
    // This test verifies that canteenAdmin (bound to 第一食堂) cannot create dishes for 第二食堂
    // We test by specifying canteenName directly - no need to find existing canteen2 dishes
    
    // Try to create with canteenAdmin (who is bound to 第一食堂)
    const token = await getApiToken(request, TEST_ACCOUNTS.canteenAdmin.username, TEST_ACCOUNTS.canteenAdmin.password);
    expect(token).toBeTruthy();
    
    const response = await request.post(`${baseURL}admin/dishes`, {
      headers: { 'Authorization': `Bearer ${token}` },
      data: {
        name: 'Test Dish - Should Fail for Canteen2',
        price: 15.0,
        canteenName: '第二食堂',
        windowName: '面食窗口'  // A window in 第二食堂
      }
    });
    
    // Should get 403 Forbidden
    expect(response.status()).toBe(403);
  });

  test('canteenAdmin should be able to create dish for their own canteen', async ({ request }) => {
    const token = await getApiToken(request, TEST_ACCOUNTS.canteenAdmin.username, TEST_ACCOUNTS.canteenAdmin.password);
    expect(token).toBeTruthy();
    
    const dishName = `Canteen Admin Test Dish ${Date.now()}`;
    const response = await request.post(`${baseURL}admin/dishes`, {
      headers: { 'Authorization': `Bearer ${token}` },
      data: {
        name: dishName,
        price: 15.0,
        canteenName: '第一食堂',
        windowName: '川菜窗口'
      }
    });
    
    // Should succeed with 201
    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.code).toBe(201);
    expect(data.data.name).toBe(dishName);
    
    // Clean up
    const superToken = await getApiToken(request, TEST_ACCOUNTS.superAdmin.username, TEST_ACCOUNTS.superAdmin.password);
    try {
      await request.delete(`${baseURL}admin/uploads/${data.data.id}`, {
        headers: { 'Authorization': `Bearer ${superToken}` }
      });
    } catch (e) {
      // Ignore cleanup errors
    }
  });
});

/**
 * Input Validation Tests
 */
test.describe('Dish Creation Validation (API)', () => {
  test('should fail when creating dish without required fields', async ({ request }) => {
    const token = await getApiToken(request, TEST_ACCOUNTS.superAdmin.username, TEST_ACCOUNTS.superAdmin.password);
    expect(token).toBeTruthy();
    
    const response = await request.post(`${baseURL}admin/dishes`, {
      headers: { 'Authorization': `Bearer ${token}` },
      data: {
        name: 'Test Dish - Missing Fields'
        // Missing: price, canteenName/canteenId, windowName/windowId
      }
    });
    
    expect(response.status()).toBe(400);
  });

  test('should fail when creating dish with invalid price', async ({ request }) => {
    const token = await getApiToken(request, TEST_ACCOUNTS.superAdmin.username, TEST_ACCOUNTS.superAdmin.password);
    expect(token).toBeTruthy();
    
    const response = await request.post(`${baseURL}admin/dishes`, {
      headers: { 'Authorization': `Bearer ${token}` },
      data: {
        name: 'Test Dish - Invalid Price',
        price: -10,  // Invalid: negative price
        canteenName: '第一食堂',
        windowName: '川菜窗口'
      }
    });
    
    expect(response.status()).toBe(400);
  });

  test('should fail when creating dish with non-existent window', async ({ request }) => {
    const token = await getApiToken(request, TEST_ACCOUNTS.superAdmin.username, TEST_ACCOUNTS.superAdmin.password);
    expect(token).toBeTruthy();
    
    const response = await request.post(`${baseURL}admin/dishes`, {
      headers: { 'Authorization': `Bearer ${token}` },
      data: {
        name: 'Test Dish - Non-existent Window',
        price: 15.0,
        canteenName: '第一食堂',
        windowId: 'non-existent-window-id'
      }
    });
    
    expect(response.status()).toBe(400);
  });
});

/**
 * Unauthorized Access Tests
 */
test.describe('Unauthorized Access (API)', () => {
  test('should return 401 when accessing dishes without token', async ({ request }) => {
    const response = await request.get(`${baseURL}admin/dishes`);
    expect(response.status()).toBe(401);
  });

  test('should return 401 when creating dish without token', async ({ request }) => {
    const response = await request.post(`${baseURL}admin/dishes`, {
      data: {
        name: 'Test Dish',
        price: 15.0,
        canteenName: '第一食堂',
        windowName: '川菜窗口'
      }
    });
    expect(response.status()).toBe(401);
  });

  test('should return 401 with invalid token', async ({ request }) => {
    const response = await request.get(`${baseURL}admin/dishes`, {
      headers: { 'Authorization': 'Bearer invalid-token-12345' }
    });
    expect(response.status()).toBe(401);
  });
});
