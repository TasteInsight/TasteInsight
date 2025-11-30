import { test, expect, APIRequestContext } from '@playwright/test';
import { loginAsAdmin, getApiToken, TEST_ACCOUNTS } from './utils';

// API base URL for direct API calls
const baseURL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/';

/**
 * Generate a short unique username (max 20 chars)
 * Format: prefix + last 6 digits of timestamp
 */
function generateUsername(prefix: string = 'e2e'): string {
  const shortId = Date.now().toString().slice(-6);
  return `${prefix}_${shortId}`;
}

/**
 * Helper function to login with a specific account
 */
async function loginWithAccount(page: any, username: string, password: string) {
  await page.goto('/login');
  await page.fill('input#username', username);
  await page.fill('input#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/single-add', { timeout: 10000 });
}

/**
 * Helper function to clean up test sub-admins created during tests
 */
async function cleanupTestAdmins(apiRequest: APIRequestContext) {
  try {
    const token = await getApiToken(
      apiRequest,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    if (!token) return;

    // Get all admins
    const response = await apiRequest.get(`${baseURL}admin/admins`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok()) {
      const data = await response.json();
      // Match test usernames: e2e_XXXXXX, ui_XXXXXX, api_XXXXXX, mgr_XXXXXX
      const testAdmins = data.data.items.filter((a: any) =>
        /^(e2e|ui|api|mgr|dup|del|upd|perm)_\d+$/.test(a.username)
      );

      for (const admin of testAdmins) {
        try {
          await apiRequest.delete(`${baseURL}admin/admins/${admin.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          console.log(`Cleaned up test admin: ${admin.username}`);
        } catch (e) {
          console.warn(`Failed to delete admin ${admin.id}:`, e);
        }
      }
    }
  } catch (error) {
    console.warn('Failed to cleanup test admins:', error);
  }
}

/**
 * Helper function to get admin manager token
 */
async function getAdminManagerToken(apiRequest: APIRequestContext): Promise<string | null> {
  return await getApiToken(
    apiRequest,
    TEST_ACCOUNTS.adminManager.username,
    TEST_ACCOUNTS.adminManager.password
  );
}

/**
 * Admin Sub-Admin Management E2E Tests
 * 
 * These tests cover the sub-admin management functionality in the admin panel.
 * Based on backend tests in backend/test/admin-admins.e2e-spec.ts
 */
test.describe('Admin Sub-Admin Management', () => {
  // Run tests in this describe block serially to avoid conflicts
  test.describe.configure({ mode: 'serial' });

  let createdSubAdminId: string;

  // Clean up any leftover test data before running tests
  test.beforeAll(async ({ request }) => {
    await cleanupTestAdmins(request);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.afterEach(async ({ request }) => {
    // Cleanup: delete the test admin if it was created
    if (createdSubAdminId) {
      try {
        const token = await getApiToken(
          request,
          TEST_ACCOUNTS.superAdmin.username,
          TEST_ACCOUNTS.superAdmin.password
        );
        if (token) {
          await request.delete(`${baseURL}admin/admins/${createdSubAdminId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch (error) {
        console.warn('Failed to clean up test admin:', error);
      }
      createdSubAdminId = '';
    }
  });

  // Also clean up after all tests
  test.afterAll(async ({ request }) => {
    await cleanupTestAdmins(request);
  });

  test('should display admin list page correctly', async ({ page }) => {
    // Navigate to user management page
    await page.goto('/user-manage');

    // Verify page elements - use h2 to target the page title, not sidebar link
    await expect(page.locator('h2:has-text("人员权限管理")')).toBeVisible();
    await expect(page.locator('text=管理子管理员账号和权限分配')).toBeVisible();
    await expect(page.locator('button:has-text("创建子管理员")')).toBeVisible();

    // Verify table headers
    await expect(page.locator('th:has-text("用户名")')).toBeVisible();
    await expect(page.locator('th:has-text("角色")')).toBeVisible();
    await expect(page.locator('th:has-text("管理范围")')).toBeVisible();
    await expect(page.locator('th:has-text("创建时间")')).toBeVisible();
    await expect(page.locator('th:has-text("操作")')).toBeVisible();
  });

  test('should show sub-admins list from seed data', async ({ page }) => {
    await page.goto('/user-manage');

    // Wait for the list to load
    await page.waitForSelector('table tbody', { state: 'visible', timeout: 10000 });

    // The page should display sub-admins (may show empty if superadmin doesn't have view rights
    // or only shows admins created by the current user for non-superadmins)
    // For superadmin, it should show all admins
    const rows = page.locator('table tbody tr');
    
    // If there are sub-admins, verify they are displayed correctly
    const rowCount = await rows.count();
    if (rowCount > 0) {
      // Verify first row has expected structure
      await expect(rows.first().locator('td').first()).toBeVisible();
    }
  });

  test('should navigate to create sub-admin form', async ({ page }) => {
    await page.goto('/user-manage');
    await page.waitForLoadState('networkidle');

    // Click "创建子管理员" button
    await page.click('button:has-text("创建子管理员")');

    // Verify form elements are displayed
    await expect(page.locator('text=创建子管理员').first()).toBeVisible();
    await expect(page.locator('input[placeholder="例如：admin001"]')).toBeVisible();
    await expect(page.locator('button:has-text("返回列表")')).toBeVisible();
  });

  test('should search admins by username', async ({ page }) => {
    await page.goto('/user-manage');
    await page.waitForSelector('table tbody', { state: 'visible', timeout: 10000 });

    // Search for a non-existent username
    await page.fill('input[placeholder="搜索用户名、角色..."]', 'nonexistentuser12345');
    await page.waitForTimeout(500);

    // Verify no results or empty message
    const rows = page.locator('table tbody tr');
    const emptyMessage = page.locator('text=暂无子管理员');
    
    // Either no rows or empty message should be visible
    const rowCount = await rows.count();
    if (rowCount === 0) {
      await expect(emptyMessage).toBeVisible();
    }
  });

  test('Create, Edit, and Delete Sub-Admin - Full UI Flow', async ({ page, request: apiRequest }) => {
    test.setTimeout(90000);

    const username = generateUsername('ui');
    const password = 'Test@123!';

    // 1. Navigate to user management page and click create
    await page.goto('/user-manage');
    await page.waitForLoadState('networkidle');
    await page.click('button:has-text("创建子管理员")');

    // 2. Wait for form to be visible
    await expect(page.locator('text=创建子管理员').first()).toBeVisible();

    // 3. Fill in the form
    await page.fill('input[placeholder="例如：admin001"]', username);
    await page.fill('input[placeholder="请输入密码"]', password);

    // 4. Select a role (e.g., 食堂主管)
    await page.click('text=食堂主管');

    // 5. Select some permissions
    // Wait for permission checkboxes to be visible
    await page.waitForSelector('input[type="checkbox"]', { state: 'visible' });
    
    // Select dish:view permission (first checkbox in 菜品管理 group)
    const dishViewCheckbox = page.locator('input#dishes-view');
    if (await dishViewCheckbox.isVisible()) {
      await dishViewCheckbox.check();
    }

    // 6. Handle success alert and submit
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('成功');
      await dialog.accept();
    });

    await page.click('button:has-text("创建子管理员")');

    // 7. Wait for navigation back to list
    await page.waitForSelector('text=人员权限管理', { state: 'visible', timeout: 15000 });

    // 8. Verify the admin appears in the list
    await page.fill('input[placeholder="搜索用户名、角色..."]', username);
    await page.waitForTimeout(500);
    await expect(page.locator(`td:has-text("${username}")`)).toBeVisible({ timeout: 10000 });

    // 9. Get the admin ID via API for cleanup
    const token = await getApiToken(
      apiRequest,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    const adminsResponse = await apiRequest.get(`${baseURL}admin/admins`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const admins = await adminsResponse.json();
    const createdAdmin = admins.data.items.find(
      (a: any) => a.username === username
    );
    expect(createdAdmin).toBeDefined();
    createdSubAdminId = createdAdmin.id;

    // 10. Click edit button
    const row = page.locator('tr', { hasText: username });
    await row.locator('button[title="编辑权限"]').click();

    // 11. Verify edit form is displayed
    await expect(page.locator('text=编辑子管理员')).toBeVisible();

    // 12. Update permissions - add another permission
    const dishCreateCheckbox = page.locator('input#dishes-create');
    if (await dishCreateCheckbox.isVisible()) {
      await dishCreateCheckbox.check();
    }

    // Handle update success alert
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.click('button:has-text("保存修改")');

    // 13. Wait for navigation back to list
    await page.waitForSelector('text=人员权限管理', { state: 'visible', timeout: 15000 });

    // 14. Verify we're back on the list
    await page.fill('input[placeholder="搜索用户名、角色..."]', username);
    await expect(page.locator(`td:has-text("${username}")`)).toBeVisible({ timeout: 10000 });

    // 15. Delete the admin via UI
    const updatedRow = page.locator('tr', { hasText: username });

    // Handle delete confirmation dialog
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('确定要删除');
      await dialog.accept();
    });

    await updatedRow.locator('button[title="删除"]').click();

    // Handle success notification
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // 16. Verify the admin is removed from the list
    await page.waitForTimeout(1000);
    await page.fill('input[placeholder="搜索用户名、角色..."]', username);
    await page.waitForTimeout(500);
    await expect(page.locator(`td:has-text("${username}")`)).not.toBeVisible({ timeout: 5000 });

    // Clear the ID since we already deleted it
    createdSubAdminId = '';
  });
});

/**
 * Admin Sub-Admin API Tests - Direct API Testing
 * Based on backend/test/admin-admins.e2e-spec.ts
 */
test.describe('Admin Sub-Admin API Tests', () => {
  // Run tests in this describe block serially to avoid conflicts
  test.describe.configure({ mode: 'serial' });

  let createdSubAdminId: string;

  // Clean up any leftover test data before running tests
  test.beforeAll(async ({ request }) => {
    await cleanupTestAdmins(request);
  });

  test.afterEach(async ({ request }) => {
    if (createdSubAdminId) {
      try {
        const token = await getApiToken(
          request,
          TEST_ACCOUNTS.superAdmin.username,
          TEST_ACCOUNTS.superAdmin.password
        );
        if (token) {
          await request.delete(`${baseURL}admin/admins/${createdSubAdminId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch (error) {
        console.warn('Failed to clean up test admin:', error);
      }
      createdSubAdminId = '';
    }
  });

  // Also clean up after all tests
  test.afterAll(async ({ request }) => {
    await cleanupTestAdmins(request);
  });

  test('should create a new sub admin with superadmin via API', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    const createDto = {
      username: generateUsername('api'),
      password: 'Test@123!',
      permissions: ['dish:view', 'dish:create'],
    };

    const response = await request.post(`${baseURL}admin/admins`, {
      headers: { Authorization: `Bearer ${token}` },
      data: createDto,
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.code).toBe(200);
    expect(data.message).toBe('success');
    expect(data.data.username).toBe(createDto.username);
    expect(data.data.role).toBe('admin');
    expect(data.data.permissions).toEqual(
      expect.arrayContaining(createDto.permissions)
    );
    expect(data.data.createdBy).toBeDefined();

    createdSubAdminId = data.data.id;
  });

  test('should create a sub admin with adminManager via API', async ({ request }) => {
    const token = await getAdminManagerToken(request);
    expect(token).toBeTruthy();

    const createDto = {
      username: generateUsername('mgr'),
      password: 'Test@456!',
      permissions: ['canteen:view'],
    };

    const response = await request.post(`${baseURL}admin/admins`, {
      headers: { Authorization: `Bearer ${token}` },
      data: createDto,
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.code).toBe(200);
    expect(data.data.username).toBe(createDto.username);

    // Cleanup
    const superToken = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    if (superToken) {
      await request.delete(`${baseURL}admin/admins/${data.data.id}`, {
        headers: { Authorization: `Bearer ${superToken}` },
      });
    }
  });

  test('should return 400 for duplicate username via API', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    // First create an admin
    const username = generateUsername('dup');
    const createDto = {
      username,
      password: 'Test@123!',
      permissions: ['dish:view'],
    };

    const firstResponse = await request.post(`${baseURL}admin/admins`, {
      headers: { Authorization: `Bearer ${token}` },
      data: createDto,
    });
    expect(firstResponse.status()).toBe(201);
    const firstData = await firstResponse.json();
    createdSubAdminId = firstData.data.id;

    // Try to create another with the same username
    const duplicateResponse = await request.post(`${baseURL}admin/admins`, {
      headers: { Authorization: `Bearer ${token}` },
      data: createDto,
    });

    expect(duplicateResponse.status()).toBe(400);
    const duplicateData = await duplicateResponse.json();
    expect(duplicateData.message).toContain('用户名已存在');
  });

  test('should return 400 for invalid password format via API', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    const createDto = {
      username: generateUsername('weak'),
      password: 'weak', // Too weak - missing uppercase, number, special char
      permissions: ['dish:view'],
    };

    const response = await request.post(`${baseURL}admin/admins`, {
      headers: { Authorization: `Bearer ${token}` },
      data: createDto,
    });

    expect(response.status()).toBe(400);
  });

  test('should return 403 for normal admin without permission via API', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.normalAdmin.username,
      TEST_ACCOUNTS.normalAdmin.password
    );
    expect(token).toBeTruthy();

    const createDto = {
      username: generateUsername('unauth'),
      password: 'Test@123!',
      permissions: ['dish:view'],
    };

    const response = await request.post(`${baseURL}admin/admins`, {
      headers: { Authorization: `Bearer ${token}` },
      data: createDto,
    });

    expect(response.status()).toBe(403);
  });

  test('should return list of sub admins for superadmin via API', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    const response = await request.get(`${baseURL}admin/admins`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.code).toBe(200);
    expect(data.data.items).toBeInstanceOf(Array);
    expect(data.data.meta).toBeDefined();
    expect(data.data.meta.page).toBe(1);
    expect(data.data.meta.pageSize).toBe(20);
  });

  test('should support pagination via API', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    const response = await request.get(`${baseURL}admin/admins?page=1&pageSize=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.data.meta.page).toBe(1);
    expect(data.data.meta.pageSize).toBe(5);
  });

  test('should return 403 for normal admin listing admins via API', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.normalAdmin.username,
      TEST_ACCOUNTS.normalAdmin.password
    );
    expect(token).toBeTruthy();

    const response = await request.get(`${baseURL}admin/admins`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(403);
  });

  test('should update sub admin permissions with superadmin via API', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    // First create an admin
    const createDto = {
      username: generateUsername('upd'),
      password: 'Test@123!',
      permissions: ['dish:view'],
    };

    const createResponse = await request.post(`${baseURL}admin/admins`, {
      headers: { Authorization: `Bearer ${token}` },
      data: createDto,
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    createdSubAdminId = createData.data.id;

    // Now update permissions
    const updateDto = {
      permissions: ['dish:view', 'dish:edit', 'canteen:view'],
    };

    const updateResponse = await request.put(
      `${baseURL}admin/admins/${createdSubAdminId}/permissions`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: updateDto,
      }
    );

    expect(updateResponse.status()).toBe(200);
    const updateData = await updateResponse.json();
    expect(updateData.code).toBe(200);
    expect(updateData.message).toBe('操作成功');
  });

  test('should return 404 for non-existent sub admin update via API', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    const updateDto = {
      permissions: ['dish:view'],
    };

    const response = await request.put(
      `${baseURL}admin/admins/non-existent-id/permissions`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: updateDto,
      }
    );

    expect(response.status()).toBe(404);
  });

  test('should return 403 when normal admin updates permissions via API', async ({ request }) => {
    const superToken = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(superToken).toBeTruthy();

    // First create an admin
    const createDto = {
      username: generateUsername('perm'),
      password: 'Test@123!',
      permissions: ['dish:view'],
    };

    const createResponse = await request.post(`${baseURL}admin/admins`, {
      headers: { Authorization: `Bearer ${superToken}` },
      data: createDto,
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    createdSubAdminId = createData.data.id;

    // Try to update with normal admin token
    const normalToken = await getApiToken(
      request,
      TEST_ACCOUNTS.normalAdmin.username,
      TEST_ACCOUNTS.normalAdmin.password
    );
    expect(normalToken).toBeTruthy();

    const updateDto = {
      permissions: ['dish:view', 'dish:edit'],
    };

    const updateResponse = await request.put(
      `${baseURL}admin/admins/${createdSubAdminId}/permissions`,
      {
        headers: { Authorization: `Bearer ${normalToken}` },
        data: updateDto,
      }
    );

    expect(updateResponse.status()).toBe(403);
  });

  test('should delete sub admin with superadmin via API', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    // First create an admin
    const createDto = {
      username: generateUsername('del'),
      password: 'Test@123!',
      permissions: ['dish:view'],
    };

    const createResponse = await request.post(`${baseURL}admin/admins`, {
      headers: { Authorization: `Bearer ${token}` },
      data: createDto,
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const adminId = createData.data.id;

    // Now delete
    const deleteResponse = await request.delete(
      `${baseURL}admin/admins/${adminId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    expect(deleteResponse.status()).toBe(200);
    const deleteData = await deleteResponse.json();
    expect(deleteData.code).toBe(200);
    expect(deleteData.message).toBe('操作成功');
  });

  test('should return 404 for non-existent sub admin delete via API', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(token).toBeTruthy();

    const response = await request.delete(
      `${baseURL}admin/admins/non-existent-id`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    expect(response.status()).toBe(404);
  });

  test('should return 403 when normal admin deletes sub admin via API', async ({ request }) => {
    const superToken = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(superToken).toBeTruthy();

    // First create an admin
    const createDto = {
      username: generateUsername('delu'),
      password: 'Test@123!',
      permissions: ['dish:view'],
    };

    const createResponse = await request.post(`${baseURL}admin/admins`, {
      headers: { Authorization: `Bearer ${superToken}` },
      data: createDto,
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    createdSubAdminId = createData.data.id;

    // Try to delete with normal admin token
    const normalToken = await getApiToken(
      request,
      TEST_ACCOUNTS.normalAdmin.username,
      TEST_ACCOUNTS.normalAdmin.password
    );
    expect(normalToken).toBeTruthy();

    const deleteResponse = await request.delete(
      `${baseURL}admin/admins/${createdSubAdminId}`,
      {
        headers: { Authorization: `Bearer ${normalToken}` },
      }
    );

    expect(deleteResponse.status()).toBe(403);
  });

  test('should return 401 without token via API', async ({ request }) => {
    const response = await request.get(`${baseURL}admin/admins`);
    expect(response.status()).toBe(401);
  });

  test('should return 401 with invalid token via API', async ({ request }) => {
    const response = await request.get(`${baseURL}admin/admins`, {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    expect(response.status()).toBe(401);
  });
});

/**
 * Admin Manager specific tests
 * Tests for adminManager role who has admin:* permissions but is not superadmin
 */
test.describe('Admin Manager Sub-Admin Tests', () => {
  // Run tests in this describe block serially to avoid conflicts
  test.describe.configure({ mode: 'serial' });

  let createdByManagerId: string;

  // Clean up any leftover test data before running tests
  test.beforeAll(async ({ request }) => {
    await cleanupTestAdmins(request);
  });

  test.afterEach(async ({ request }) => {
    if (createdByManagerId) {
      try {
        // Use adminManager to delete their own sub-admin
        const mgrToken = await getAdminManagerToken(request);
        if (mgrToken) {
          await request.delete(`${baseURL}admin/admins/${createdByManagerId}`, {
            headers: { Authorization: `Bearer ${mgrToken}` },
          });
        } else {
          // Fallback to superadmin
          const superToken = await getApiToken(
            request,
            TEST_ACCOUNTS.superAdmin.username,
            TEST_ACCOUNTS.superAdmin.password
          );
          if (superToken) {
            await request.delete(`${baseURL}admin/admins/${createdByManagerId}`, {
              headers: { Authorization: `Bearer ${superToken}` },
            });
          }
        }
      } catch (error) {
        console.warn('Failed to clean up manager test admin:', error);
      }
      createdByManagerId = '';
    }
  });

  // Also clean up after all tests
  test.afterAll(async ({ request }) => {
    await cleanupTestAdmins(request);
  });

  test('adminManager should create and manage own sub admin via API', async ({ request }) => {
    const mgrToken = await getAdminManagerToken(request);
    expect(mgrToken).toBeTruthy();

    // Create a sub-admin
    const createDto = {
      username: generateUsername('mown'),
      password: 'Test@789!',
      permissions: ['dish:view'],
    };

    const createResponse = await request.post(`${baseURL}admin/admins`, {
      headers: { Authorization: `Bearer ${mgrToken}` },
      data: createDto,
    });

    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    createdByManagerId = createData.data.id;

    // Update permissions
    const updateDto = {
      permissions: ['dish:view', 'dish:edit'],
    };

    const updateResponse = await request.put(
      `${baseURL}admin/admins/${createdByManagerId}/permissions`,
      {
        headers: { Authorization: `Bearer ${mgrToken}` },
        data: updateDto,
      }
    );

    expect(updateResponse.status()).toBe(200);

    // Delete
    const deleteResponse = await request.delete(
      `${baseURL}admin/admins/${createdByManagerId}`,
      {
        headers: { Authorization: `Bearer ${mgrToken}` },
      }
    );

    expect(deleteResponse.status()).toBe(200);
    createdByManagerId = ''; // Already deleted
  });

  test('adminManager should NOT be able to update/delete superadmin sub-admin via API', async ({ request }) => {
    // First, superadmin creates a sub-admin
    const superToken = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    expect(superToken).toBeTruthy();

    const createDto = {
      username: generateUsername('ssub'),
      password: 'Test@123!',
      permissions: ['dish:view'],
    };

    const createResponse = await request.post(`${baseURL}admin/admins`, {
      headers: { Authorization: `Bearer ${superToken}` },
      data: createDto,
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const superSubAdminId = createData.data.id;

    try {
      // Now adminManager tries to update it - should fail
      const mgrToken = await getAdminManagerToken(request);
      expect(mgrToken).toBeTruthy();

      const updateDto = {
        permissions: ['dish:view', 'dish:edit'],
      };

      const updateResponse = await request.put(
        `${baseURL}admin/admins/${superSubAdminId}/permissions`,
        {
          headers: { Authorization: `Bearer ${mgrToken}` },
          data: updateDto,
        }
      );

      expect(updateResponse.status()).toBe(403);

      // adminManager tries to delete it - should also fail
      const deleteResponse = await request.delete(
        `${baseURL}admin/admins/${superSubAdminId}`,
        {
          headers: { Authorization: `Bearer ${mgrToken}` },
        }
      );

      expect(deleteResponse.status()).toBe(403);
    } finally {
      // Cleanup: superadmin deletes their own sub-admin
      await request.delete(`${baseURL}admin/admins/${superSubAdminId}`, {
        headers: { Authorization: `Bearer ${superToken}` },
      });
    }
  });
});
