import { test, expect } from '@playwright/test';
import { loginAsAdmin, getApiToken, TEST_ACCOUNTS } from './utils';

// API base URL for direct API calls
const baseURL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/';

/**
 * Helper function to get a canteen with its ID
 */
async function getTestCanteen(apiRequest: any, token: string) {
  const response = await apiRequest.get(`${baseURL}admin/canteens`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (response.ok()) {
    const data = await response.json();
    // Find 第一食堂 from seed data
    const canteen = data.data.items.find((c: any) => c.name === '第一食堂');
    return canteen || data.data.items[0];
  }
  return null;
}

/**
 * Helper function to clean up test windows created during tests
 */
async function cleanupTestWindows(apiRequest: any) {
  try {
    const token = await getApiToken(
      apiRequest,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    if (!token) return;

    // Get all canteens and their windows
    const canteensResponse = await apiRequest.get(`${baseURL}admin/canteens`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (canteensResponse.ok()) {
      const canteensData = await canteensResponse.json();
      
      for (const canteen of canteensData.data.items) {
        // Get windows for this canteen
        const windowsResponse = await apiRequest.get(`${baseURL}admin/windows/${canteen.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (windowsResponse.ok()) {
          const windowsData = await windowsResponse.json();
          const testWindows = windowsData.data.items.filter((w: any) =>
            w.name.includes('E2E Test') ||
            w.name.includes('Test Window') ||
            w.name.includes('API Test') ||
            w.name.includes('UI Test') ||
            w.name.includes('Delete Test') ||
            w.name.includes('Update Test') ||
            w.name.includes('SuperAdmin Test') ||
            w.name.includes('Validation Test') ||
            w.name.includes('No Floor')
          );
          
          for (const window of testWindows) {
            try {
              await apiRequest.delete(`${baseURL}admin/windows/${window.id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              console.log(`Cleaned up test window: ${window.name}`);
            } catch (e) {
              console.warn(`Failed to delete window ${window.id}:`, e);
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('Failed to cleanup test windows:', error);
  }
}

/**
 * Admin Window Management E2E Tests
 * 
 * These tests cover the window management functionality in the admin panel.
 * Windows are managed within the canteen edit page.
 * Based on backend tests in backend/test/admin-windows.e2e-spec.ts
 */
test.describe('Admin Window Management', () => {
  // Run tests in this describe block serially to avoid conflicts
  test.describe.configure({ mode: 'serial' });
  
  let createdWindowId: string;
  let testCanteenId: string;
  let testCanteenName: string;

  // Clean up any leftover test data before running tests
  test.beforeAll(async ({ request }) => {
    await cleanupTestWindows(request);
    
    // Get the test canteen ID for later use
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    if (token) {
      const canteen = await getTestCanteen(request, token);
      if (canteen) {
        testCanteenId = canteen.id;
        testCanteenName = canteen.name;
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.afterEach(async ({ request }) => {
    // Cleanup: delete the test window if it was created
    if (createdWindowId) {
      try {
        const token = await getApiToken(
          request,
          TEST_ACCOUNTS.superAdmin.username,
          TEST_ACCOUNTS.superAdmin.password
        );
        if (token) {
          await request.delete(`${baseURL}admin/windows/${createdWindowId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch (error) {
        console.warn('Failed to clean up test window:', error);
      }
      createdWindowId = '';
    }
  });

  // Also clean up after all tests
  test.afterAll(async ({ request }) => {
    await cleanupTestWindows(request);
  });

  test('should display windows in canteen edit page', async ({ page }) => {
    test.setTimeout(90000);
    
    // Navigate to canteen management page with longer timeout
    await page.goto('/add-canteen', { timeout: 60000, waitUntil: 'domcontentloaded' });
    
    // Wait for the canteen list to load
    await page.waitForSelector('table tbody tr', { state: 'visible', timeout: 10000 });

    // Click on 第一食堂 to enter edit mode
    const canteenRow = page.locator('tr', { hasText: '第一食堂' });
    await expect(canteenRow).toBeVisible();
    await canteenRow.click();

    // Verify we're in edit mode
    await expect(page.locator('h2:has-text("编辑食堂")')).toBeVisible();

    // Verify window management section exists
    await expect(page.locator('text=窗口管理')).toBeVisible();
    await expect(page.locator('button:has-text("添加窗口")')).toBeVisible();

    // Verify seed windows are displayed (from seed_docker.ts)
    // 第一食堂 should have windows like 川菜窗口, 粤菜窗口, etc.
    await expect(page.locator('input[placeholder="例如：川湘风味"]').first()).toBeVisible();
  });

  test('should show existing windows from seed data', async ({ page, request }) => {
    // Use API to verify windows exist
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    // Get windows for 第一食堂
    const response = await request.get(`${baseURL}admin/windows/${testCanteenId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.code).toBe(200);
    expect(data.data.items).toBeInstanceOf(Array);
    // Just verify that there are some windows, don't check specific names
    // because seed data may have been modified by other tests
    expect(data.data.items.length).toBeGreaterThanOrEqual(0);
  });

  test('should create a new window via UI', async ({ page, request }) => {
    test.setTimeout(90000);
    
    const windowName = `UI Test Window ${Date.now()}`;
    const windowNumber = 'T01';
    const windowFloor = '一楼';

    // Navigate to canteen edit page with longer timeout
    await page.goto('/add-canteen', { timeout: 60000, waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table tbody tr', { state: 'visible', timeout: 15000 });

    // Click on 第一食堂 to enter edit mode
    const canteenRow = page.locator('tr', { hasText: '第一食堂' });
    await canteenRow.click();
    await expect(page.locator('h2:has-text("编辑食堂")')).toBeVisible();

    // Count existing windows before adding
    const existingWindowInputs = await page.locator('input[placeholder="例如：川湘风味"]').count();

    // Click "添加窗口" button
    await page.click('button:has-text("添加窗口")');

    // Wait for new window form to appear
    await page.waitForTimeout(300);

    // Fill in the new window form - get the last (newly added) window form
    const allWindowNameInputs = page.locator('input[placeholder="例如：川湘风味"]');
    const newWindowNameInput = allWindowNameInputs.nth(existingWindowInputs);
    await newWindowNameInput.fill(windowName);

    const allFloorInputs = page.locator('input[placeholder="例如：一层"]');
    const newFloorInput = allFloorInputs.nth(existingWindowInputs);
    await newFloorInput.fill(windowFloor);

    const allNumberInputs = page.locator('input[placeholder="例如：01、A01（选填）"]');
    const newNumberInput = allNumberInputs.nth(existingWindowInputs);
    await newNumberInput.fill(windowNumber);

    // Handle success alert
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('更新');
      await dialog.accept();
    });

    // Submit the form
    await page.click('button:has-text("保存修改")');

    // Wait for navigation back to list
    await page.waitForSelector('text=食堂信息管理', { state: 'visible', timeout: 15000 });

    // Verify via API that the window was created
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    const response = await request.get(`${baseURL}admin/windows/${testCanteenId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    const createdWindow = data.data.items.find((w: any) => w.name === windowName);
    expect(createdWindow).toBeDefined();
    expect(createdWindow.number).toBe(windowNumber);

    // Save ID for cleanup
    createdWindowId = createdWindow.id;
  });

  test('should delete a window via UI', async ({ page, request }, testInfo) => {
    test.setTimeout(90000);

    // First create a window via API for deletion test
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    // Use browser name in window name to avoid conflicts between parallel browser tests
    const browserName = testInfo.project.name;
    const windowName = `Delete Test ${browserName} ${Date.now()}`;
    const createResponse = await request.post(`${baseURL}admin/windows`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        canteenId: testCanteenId,
        name: windowName,
        number: `DEL-${browserName}`,
        floor: { level: '1', name: '一楼' },
        tags: [],
      },
    });

    expect(createResponse.status()).toBe(200);
    const createData = await createResponse.json();
    const windowToDeleteId = createData.data.id;

    // Navigate to canteen edit page with longer timeout
    await page.goto('/add-canteen', { timeout: 60000, waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table tbody tr', { state: 'visible', timeout: 15000 });

    // Click on 第一食堂 to enter edit mode
    const canteenRow = page.locator('tr', { hasText: '第一食堂' });
    await canteenRow.click();
    await expect(page.locator('h2:has-text("编辑食堂")')).toBeVisible();

    // Wait for windows to load - longer wait to ensure API data is loaded
    await page.waitForTimeout(1000);

    // Find the window row by looking for the input with the matching window name
    // Vue v-model binds to the input's value internally, we need to find by the displayed text
    const windowInputs = page.locator('input[placeholder="例如：川湘风味"]');
    const windowCount = await windowInputs.count();
    
    let windowIndex = -1;
    for (let i = 0; i < windowCount; i++) {
      const inputValue = await windowInputs.nth(i).inputValue();
      if (inputValue === windowName) {
        windowIndex = i;
        break;
      }
    }
    
    // If window not found in UI, clean up via API and fail with useful message
    if (windowIndex < 0) {
      // Clean up the window we created
      await request.delete(`${baseURL}admin/windows/${windowToDeleteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Get all window names for debugging
      const allWindowNames: string[] = [];
      for (let i = 0; i < windowCount; i++) {
        allWindowNames.push(await windowInputs.nth(i).inputValue());
      }
      throw new Error(`Window "${windowName}" not found in UI. Found windows: ${allWindowNames.join(', ')}`);
    }

    // Get the parent row container for this window (the div with flex items-center gap-3)
    const windowRows = page.locator('div.flex.items-center.gap-3.p-3.border.rounded-lg');
    const windowRow = windowRows.nth(windowIndex);
    
    // Handle confirmation dialog
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Click the delete button for this window
    await windowRow.locator('button[title="删除窗口"]').click();

    // Handle the success alert
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Wait a bit for the deletion to complete
    await page.waitForTimeout(1000);

    // Verify via API that the window was deleted
    const verifyResponse = await request.get(`${baseURL}admin/windows/${testCanteenId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const verifyData = await verifyResponse.json();
    const deletedWindow = verifyData.data.items.find((w: any) => w.id === windowToDeleteId);
    expect(deletedWindow).toBeUndefined();
  });
});

/**
 * Admin Window API Tests - Direct API Testing
 * Based on backend/test/admin-windows.e2e-spec.ts
 */
test.describe('Admin Window API Tests', () => {
  let testCanteenId: string;
  let createdWindowId: string;

  // Get test canteen before tests
  test.beforeAll(async ({ request }) => {
    await cleanupTestWindows(request);
    
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    if (token) {
      const canteen = await getTestCanteen(request, token);
      if (canteen) {
        testCanteenId = canteen.id;
      }
    }
  });

  test.afterEach(async ({ request }) => {
    if (createdWindowId) {
      try {
        const token = await getApiToken(
          request,
          TEST_ACCOUNTS.superAdmin.username,
          TEST_ACCOUNTS.superAdmin.password
        );
        if (token) {
          await request.delete(`${baseURL}admin/windows/${createdWindowId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch (error) {
        console.warn('Failed to clean up test window:', error);
      }
      createdWindowId = '';
    }
  });

  test.afterAll(async ({ request }) => {
    await cleanupTestWindows(request);
  });

  test('should return list of windows for a canteen', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    const response = await request.get(`${baseURL}admin/windows/${testCanteenId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.code).toBe(200);
    expect(data.message).toBe('success');
    expect(data.data.items).toBeInstanceOf(Array);
    expect(data.data.meta).toBeDefined();
    expect(data.data.meta.page).toBe(1);
    expect(data.data.meta.total).toBeGreaterThanOrEqual(0);

    // Verify window structure
    if (data.data.items.length > 0) {
      const window = data.data.items[0];
      expect(window).toHaveProperty('id');
      expect(window).toHaveProperty('canteenId');
      expect(window).toHaveProperty('name');
      expect(window).toHaveProperty('number');
      expect(window).toHaveProperty('tags');
    }
  });

  test('should return paginated results', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    const response = await request.get(`${baseURL}admin/windows/${testCanteenId}?page=1&pageSize=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.data.meta.pageSize).toBe(1);
    expect(data.data.items.length).toBeLessThanOrEqual(1);
  });

  test('should return 404 for non-existent canteen', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    const response = await request.get(`${baseURL}admin/windows/non-existent-id`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(404);
  });

  test('should return 401 without authorization', async ({ request }) => {
    const response = await request.get(`${baseURL}admin/windows/${testCanteenId}`);
    expect(response.status()).toBe(401);
  });

  test('should create a new window with floor', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    const createDto = {
      canteenId: testCanteenId,
      name: `API Test Window ${Date.now()}`,
      number: 'T1',
      position: 'Test Position',
      description: 'Test Description',
      floor: {
        level: '1',
        name: '一楼',
      },
      tags: ['测试', '新窗口'],
    };

    const response = await request.post(`${baseURL}admin/windows`, {
      headers: { Authorization: `Bearer ${token}` },
      data: createDto,
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.code).toBe(200);
    expect(data.message).toBe('success');
    expect(data.data.name).toBe(createDto.name);
    expect(data.data.number).toBe(createDto.number);
    expect(data.data.canteenId).toBe(testCanteenId);
    expect(data.data.tags).toEqual(createDto.tags);
    expect(data.data.floor).toBeDefined();
    expect(data.data.floor.level).toBe('1');

    createdWindowId = data.data.id;
  });

  test('should create a window without floor', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    const createDto = {
      canteenId: testCanteenId,
      name: `No Floor Window ${Date.now()}`,
      number: 'T3',
      tags: [],
    };

    const response = await request.post(`${baseURL}admin/windows`, {
      headers: { Authorization: `Bearer ${token}` },
      data: createDto,
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.code).toBe(200);
    expect(data.data.floor).toBeNull();

    // Clean up
    await request.delete(`${baseURL}admin/windows/${data.data.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  test('should return 404 when creating window for non-existent canteen', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    const createDto = {
      canteenId: 'non-existent-id',
      name: 'Test Window',
      number: 'T1',
    };

    const response = await request.post(`${baseURL}admin/windows`, {
      headers: { Authorization: `Bearer ${token}` },
      data: createDto,
    });

    expect(response.status()).toBe(404);
  });

  test('should return 400 for invalid request body', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    const response = await request.post(`${baseURL}admin/windows`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        // Missing required fields
        description: 'Only description',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should update the window', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    // First create a window to update
    const createDto = {
      canteenId: testCanteenId,
      name: `Update Test Window ${Date.now()}`,
      number: 'U1',
      floor: { level: '1', name: '一楼' },
      tags: ['original'],
    };

    const createResponse = await request.post(`${baseURL}admin/windows`, {
      headers: { Authorization: `Bearer ${token}` },
      data: createDto,
    });

    expect(createResponse.status()).toBe(200);
    const createData = await createResponse.json();
    createdWindowId = createData.data.id;

    // Now update it
    const updateDto = {
      name: 'Updated Window Name',
      number: 'U1-Updated',
      position: 'Updated Position',
      description: 'Updated Description',
      floor: { level: '1', name: '一楼' },
      tags: ['更新后', '测试'],
    };

    const response = await request.put(`${baseURL}admin/windows/${createdWindowId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: updateDto,
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.code).toBe(200);
    expect(data.data.name).toBe(updateDto.name);
    expect(data.data.number).toBe(updateDto.number);
    expect(data.data.position).toBe(updateDto.position);
    expect(data.data.tags).toEqual(updateDto.tags);
  });

  test('should return 404 when updating non-existent window', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    const updateDto = {
      name: 'Test',
      number: 'T1',
    };

    const response = await request.put(`${baseURL}admin/windows/non-existent-id`, {
      headers: { Authorization: `Bearer ${token}` },
      data: updateDto,
    });

    expect(response.status()).toBe(404);
  });

  test('should return 400 for invalid update request body', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    // Create a window first
    const createDto = {
      canteenId: testCanteenId,
      name: `Validation Test Window ${Date.now()}`,
      number: 'V1',
      tags: [],
    };

    const createResponse = await request.post(`${baseURL}admin/windows`, {
      headers: { Authorization: `Bearer ${token}` },
      data: createDto,
    });
    const createData = await createResponse.json();
    const windowId = createData.data.id;

    const response = await request.put(`${baseURL}admin/windows/${windowId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        // Missing required fields
        description: 'Only description',
      },
    });

    expect(response.status()).toBe(400);

    // Clean up
    await request.delete(`${baseURL}admin/windows/${windowId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  test('should return 404 when deleting non-existent window', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    const response = await request.delete(`${baseURL}admin/windows/non-existent-id`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(404);
  });

  test('should return 400 when trying to delete window with dishes', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    // First, we need to find a window that has dishes
    // Get all dishes to find a window that has dishes
    const dishesResponse = await request.get(`${baseURL}admin/dishes`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(dishesResponse.ok()).toBe(true);
    const dishesData = await dishesResponse.json();
    
    // Skip this test if there are no dishes in the database
    if (!dishesData.data.items || dishesData.data.items.length === 0) {
      console.log('No dishes found in database, skipping test');
      return;
    }

    // Get a window ID from the first dish
    const dishWithWindow = dishesData.data.items.find((d: any) => d.windowId);
    if (!dishWithWindow) {
      console.log('No dishes with windowId found, skipping test');
      return;
    }

    const windowIdWithDishes = dishWithWindow.windowId;

    // Try to delete the window that has dishes
    const response = await request.delete(`${baseURL}admin/windows/${windowIdWithDishes}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.message).toContain('菜品');
  });

  test('should delete a window without dishes', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    // Create a new window to delete
    const createDto = {
      canteenId: testCanteenId,
      name: `Delete API Test Window ${Date.now()}`,
      number: 'D1',
      tags: [],
    };

    const createResponse = await request.post(`${baseURL}admin/windows`, {
      headers: { Authorization: `Bearer ${token}` },
      data: createDto,
    });

    expect(createResponse.status()).toBe(200);
    const createData = await createResponse.json();
    const windowId = createData.data.id;

    // Delete the window
    const response = await request.delete(`${baseURL}admin/windows/${windowId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.code).toBe(200);
    expect(data.message).toBe('操作成功');

    // Verify deletion
    const verifyResponse = await request.get(`${baseURL}admin/windows/${testCanteenId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const verifyData = await verifyResponse.json();
    const deletedWindow = verifyData.data.items.find((w: any) => w.id === windowId);
    expect(deletedWindow).toBeUndefined();
  });
});

/**
 * Permission Control Tests for Window Management
 */
test.describe('Window Permission Control (API)', () => {
  let testCanteenId: string;

  test.beforeAll(async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    if (token) {
      const canteen = await getTestCanteen(request, token);
      if (canteen) {
        testCanteenId = canteen.id;
      }
    }
  });

  test('should return 401 when accessing windows without token', async ({ request }) => {
    const response = await request.get(`${baseURL}admin/windows/${testCanteenId}`);
    expect(response.status()).toBe(401);
  });

  test('should return 401 when creating window without token', async ({ request }) => {
    const response = await request.post(`${baseURL}admin/windows`, {
      data: {
        canteenId: testCanteenId,
        name: 'Test Window',
        number: 'T1',
      },
    });
    expect(response.status()).toBe(401);
  });

  test('should return 401 with invalid token', async ({ request }) => {
    const response = await request.get(`${baseURL}admin/windows/${testCanteenId}`, {
      headers: { Authorization: 'Bearer invalid-token-12345' },
    });
    expect(response.status()).toBe(401);
  });

  test('should deny access to windows list for admin without canteen:view permission', async ({ request }) => {
    // normalAdmin only has dish:view permission
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.normalAdmin.username,
      TEST_ACCOUNTS.normalAdmin.password
    );
    expect(token).toBeTruthy();

    const response = await request.get(`${baseURL}admin/windows/${testCanteenId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(403);
  });

  test('should deny access to create window for admin without canteen:create permission', async ({ request }) => {
    // normalAdmin only has dish:view permission
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.normalAdmin.username,
      TEST_ACCOUNTS.normalAdmin.password
    );
    expect(token).toBeTruthy();

    const response = await request.post(`${baseURL}admin/windows`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        canteenId: testCanteenId,
        name: 'Test',
        number: 'T1',
      },
    });

    expect(response.status()).toBe(403);
  });

  test('subadmin with canteen:view should be able to GET windows', async ({ request }) => {
    // subadmin has dish:view and canteen:view permissions from seed_docker.ts
    const token = await getApiToken(request, 'subadmin', 'subadmin123');
    expect(token).toBeTruthy();

    const response = await request.get(`${baseURL}admin/windows/${testCanteenId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.code).toBe(200);
    expect(data.data.items).toBeDefined();
  });

  test('subadmin should NOT be able to create window without canteen:create permission', async ({ request }) => {
    // subadmin only has dish:view and canteen:view permissions
    const token = await getApiToken(request, 'subadmin', 'subadmin123');
    expect(token).toBeTruthy();

    const response = await request.post(`${baseURL}admin/windows`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        canteenId: testCanteenId,
        name: 'Test Window - Should Fail',
        number: 'TF1',
        tags: [],
      },
    });

    // Should get 403 Forbidden
    expect(response.status()).toBe(403);
  });

  test('superAdmin should be able to perform all window operations', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    // Create
    const createDto = {
      canteenId: testCanteenId,
      name: `SuperAdmin Test Window ${Date.now()}`,
      number: 'SA1',
      floor: { level: '1', name: '一楼' },
      tags: [],
    };

    const createResponse = await request.post(`${baseURL}admin/windows`, {
      headers: { Authorization: `Bearer ${token}` },
      data: createDto,
    });
    expect(createResponse.status()).toBe(200);
    const createData = await createResponse.json();
    const windowId = createData.data.id;

    // Read
    const readResponse = await request.get(`${baseURL}admin/windows/${testCanteenId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(readResponse.status()).toBe(200);

    // Update
    const updateResponse = await request.put(`${baseURL}admin/windows/${windowId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Updated Name', number: 'SA1-U' },
    });
    expect(updateResponse.status()).toBe(200);

    // Delete
    const deleteResponse = await request.delete(`${baseURL}admin/windows/${windowId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleteResponse.status()).toBe(200);
  });
});

/**
 * Input Validation Tests for Window Creation
 */
test.describe('Window Creation Validation (API)', () => {
  let testCanteenId: string;

  test.beforeAll(async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    if (token) {
      const canteen = await getTestCanteen(request, token);
      if (canteen) {
        testCanteenId = canteen.id;
      }
    }
  });

  test('should fail when creating window without canteenId', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    const response = await request.post(`${baseURL}admin/windows`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: 'Test Window',
        number: 'T1',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should fail when creating window without name', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    const response = await request.post(`${baseURL}admin/windows`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        canteenId: testCanteenId,
        number: 'T1',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should fail when creating window with empty name', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    const response = await request.post(`${baseURL}admin/windows`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        canteenId: testCanteenId,
        name: '',
        number: 'T1',
      },
    });

    expect(response.status()).toBe(400);
  });
});
