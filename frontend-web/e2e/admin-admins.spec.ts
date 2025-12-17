import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { loginAsAdmin, getApiToken, TEST_ACCOUNTS, API_BASE_URL } from './utils';

// API base URL for direct API calls
const baseURL = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;

/**
 * Generate a short unique username (max 20 chars)
 * Format: prefix + last 6 digits of timestamp
 */
function generateUsername(prefix: string = 'e2e'): string {
  const shortId = Date.now().toString().slice(-6);
  return `${prefix}_${shortId}`;
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
    const response = await apiRequest.get(`${baseURL}admin/admins?pageSize=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok()) {
      const data = await response.json();
      // Match test usernames with all prefixes used in tests
      const testAdmins = data.data.items.filter((a: any) =>
        /^(e2e|ui|api|mgr|dup|del|upd|perm|weak|unauth|delu|mown|ssub|full|edit|batch)_\d+$/.test(a.username)
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
 * Helper function to get superadmin API token
 */
async function getSuperAdminToken(apiRequest: APIRequestContext): Promise<string | null> {
  return await getApiToken(
    apiRequest,
    TEST_ACCOUNTS.superAdmin.username,
    TEST_ACCOUNTS.superAdmin.password
  );
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
 * Helper to create a sub-admin via API
 */
async function createSubAdminViaApi(
  apiRequest: APIRequestContext,
  token: string,
  data: { username: string; password: string; permissions: string[]; canteenId?: string }
): Promise<{ id: string; username: string } | null> {
  try {
    const response = await apiRequest.post(`${baseURL}admin/admins`, {
      headers: { Authorization: `Bearer ${token}` },
      data,
    });
    if (response.ok()) {
      const result = await response.json();
      return { id: result.data.id, username: result.data.username };
    }
  } catch (e) {
    console.warn('Failed to create sub-admin via API:', e);
  }
  return null;
}

/**
 * Helper to delete a sub-admin via API
 */
async function deleteSubAdminViaApi(
  apiRequest: APIRequestContext,
  token: string,
  adminId: string
): Promise<boolean> {
  try {
    const response = await apiRequest.delete(`${baseURL}admin/admins/${adminId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.ok();
  } catch (e) {
    console.warn('Failed to delete sub-admin via API:', e);
    return false;
  }
}

/**
 * Admin Sub-Admin Management UI E2E Tests
 * 
 * Tests for the user-manage page (/user-manage) functionality
 */
test.describe('Admin Sub-Admin Management - UI Tests', () => {
  test.describe.configure({ mode: 'serial' });

  // Clean up any leftover test data before running tests
  test.beforeAll(async ({ request }) => {
    await cleanupTestAdmins(request);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.afterAll(async ({ request }) => {
    await cleanupTestAdmins(request);
  });

  test('should display admin list page correctly', async ({ page }) => {
    await page.goto('/user-manage');
    await page.waitForLoadState('networkidle');

    // Verify page header
    await expect(page.locator('h2:has-text("人员权限管理")')).toBeVisible();
    await expect(page.locator('text=管理子管理员账号和权限分配')).toBeVisible();

    // Verify create button exists
    await expect(page.locator('button:has-text("创建子管理员")')).toBeVisible();

    // Verify search input exists
    await expect(page.locator('input[placeholder="搜索用户名、角色（权限组合）..."]')).toBeVisible();

    // Verify table headers
    await expect(page.locator('th:has-text("用户名")')).toBeVisible();
    await expect(page.locator('th:has-text("角色（权限组合）")')).toBeVisible();
    await expect(page.locator('th:has-text("管理范围")')).toBeVisible();
    await expect(page.locator('th:has-text("创建时间")')).toBeVisible();
    await expect(page.locator('th:has-text("操作")')).toBeVisible();
  });

  test('should navigate to create form when clicking create button', async ({ page }) => {
    await page.goto('/user-manage');
    await page.waitForLoadState('networkidle');

    // Click "创建子管理员" button
    await page.click('button:has-text("创建子管理员")');

    // Verify form elements are displayed
    await expect(page.locator('h2:has-text("创建子管理员")')).toBeVisible();
    await expect(page.locator('input[placeholder="例如：admin001"]')).toBeVisible();
    await expect(page.locator('input[placeholder="请输入密码"]')).toBeVisible();
    await expect(page.locator('button:has-text("返回列表")')).toBeVisible();
    await expect(page.locator('button:has-text("随机生成")')).toBeVisible();
  });

  test('should show validation errors for empty form submission', async ({ page }) => {
    await page.goto('/user-manage');
    await page.waitForLoadState('networkidle');

    // Click create button
    await page.click('button:has-text("创建子管理员")');

    // Wait for form to be visible
    await expect(page.locator('h2:has-text("创建子管理员")')).toBeVisible();

    // Clear default password (if any)
    await page.fill('input[placeholder="请输入密码"]', '');

    // Try to submit empty form (click the submit button at the bottom)
    await page.locator('button:has-text("创建子管理员")').last().click();

    // Verify validation error messages
    await expect(page.locator('text=请填写用户名')).toBeVisible();
    await expect(page.locator('text=请填写初始密码')).toBeVisible();
  });

  test('should generate random password when clicking generate button', async ({ page }) => {
    await page.goto('/user-manage');
    await page.waitForLoadState('networkidle');

    // Navigate to create form
    await page.click('button:has-text("创建子管理员")');
    await expect(page.locator('h2:has-text("创建子管理员")')).toBeVisible();

    // Get initial password value
    const passwordInput = page.locator('input[placeholder="请输入密码"]');
    const initialPassword = await passwordInput.inputValue();

    // Click generate button
    await page.click('button:has-text("随机生成")');

    // Verify password changed
    const newPassword = await passwordInput.inputValue();
    expect(newPassword).not.toBe('');
    expect(newPassword.length).toBeGreaterThanOrEqual(8);
  });

  test('should return to list when clicking back button', async ({ page }) => {
    await page.goto('/user-manage');
    await page.waitForLoadState('networkidle');

    // Navigate to create form
    await page.click('button:has-text("创建子管理员")');
    await expect(page.locator('h2:has-text("创建子管理员")')).toBeVisible();

    // Click back button
    await page.click('button:has-text("返回列表")');

    // Verify we're back on the list
    await expect(page.locator('h2:has-text("人员权限管理")')).toBeVisible();
    await expect(page.locator('th:has-text("用户名")')).toBeVisible();
  });

  test('should search admins by username', async ({ page, request }) => {
    // First, create a test admin via API
    const token = await getSuperAdminToken(request);
    expect(token).toBeTruthy();
    
    const username = generateUsername('batch');
    const admin = await createSubAdminViaApi(request, token!, {
      username,
      password: 'Test@123!',
      permissions: ['dish:view'],
    });
    expect(admin).toBeTruthy();

    try {
      await page.goto('/user-manage');
      await page.waitForLoadState('networkidle');

      // Wait for table to load
      await page.waitForSelector('table tbody', { state: 'visible', timeout: 10000 });

      // Search for the created admin
      await page.fill('input[placeholder="搜索用户名、角色（权限组合）..."]', username);
      
      // Wait for filtering to apply
      await page.waitForTimeout(500);

      // Verify the admin appears
      await expect(page.locator(`td:has-text("${username}")`)).toBeVisible({ timeout: 5000 });

      // Search for non-existent user
      await page.fill('input[placeholder="搜索用户名、角色（权限组合）..."]', 'nonexistentuser99999');
      await page.waitForTimeout(500);

      // Verify no results or empty message
      const rows = page.locator('table tbody tr');
      const rowCount = await rows.count();
      if (rowCount === 0) {
        await expect(page.locator('text=暂无子管理员')).toBeVisible();
      } else {
        // Table might still show because of loading, wait a bit more
        await page.waitForTimeout(500);
      }
    } finally {
      // Cleanup
      if (admin) {
        await deleteSubAdminViaApi(request, token!, admin.id);
      }
    }
  });

  test('should display role selection options in create form', async ({ page }) => {
    await page.goto('/user-manage');
    await page.waitForLoadState('networkidle');

    await page.click('button:has-text("创建子管理员")');
    await expect(page.locator('h2:has-text("创建子管理员")')).toBeVisible();

    // Verify role options are displayed
    await expect(page.locator('text=超级管理员')).toBeVisible();
    await expect(page.locator('text=食堂主管')).toBeVisible();
    await expect(page.locator('text=餐厅经理')).toBeVisible();
    await expect(page.locator('text=后厨操作员')).toBeVisible();
    await expect(page.locator('text=新闻编辑')).toBeVisible();
    await expect(page.locator('text=内容审核员')).toBeVisible();
    await expect(page.locator('text=自定义角色')).toBeVisible();
    await expect(page.locator('text=不选择角色')).toBeVisible();
  });

  test('should display permission groups in create form', async ({ page }) => {
    await page.goto('/user-manage');
    await page.waitForLoadState('networkidle');

    await page.click('button:has-text("创建子管理员")');
    await expect(page.locator('h2:has-text("创建子管理员")')).toBeVisible();

    // Verify permission groups are displayed
    await expect(page.locator('h4:has-text("菜品管理")')).toBeVisible();
    await expect(page.locator('h4:has-text("食堂与窗口管理")')).toBeVisible();
    await expect(page.locator('h4:has-text("内容审核")')).toBeVisible();
    await expect(page.locator('h4:has-text("新闻管理")')).toBeVisible();
    await expect(page.locator('h4:has-text("子管理员管理")')).toBeVisible();
    await expect(page.locator('h4:has-text("配置管理")')).toBeVisible();

    // Verify individual permissions exist
    await expect(page.locator('label:has-text("浏览菜品列表")')).toBeVisible();
    await expect(page.locator('label:has-text("新建菜品")')).toBeVisible();
  });
});

/**
 * Admin Sub-Admin Full CRUD Flow Tests
 */
test.describe('Admin Sub-Admin CRUD Flow - UI Tests', () => {
  test.describe.configure({ mode: 'serial' });

  let createdAdminId: string = '';
  const testUsername = generateUsername('full');

  test.beforeAll(async ({ request }) => {
    await cleanupTestAdmins(request);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.afterAll(async ({ request }) => {
    // Final cleanup
    if (createdAdminId) {
      const token = await getSuperAdminToken(request);
      if (token) {
        await deleteSubAdminViaApi(request, token, createdAdminId);
      }
    }
    await cleanupTestAdmins(request);
  });

  test('should create a new sub-admin via UI', async ({ page, request }) => {
    test.setTimeout(60000);

    await page.goto('/user-manage');
    await page.waitForLoadState('networkidle');

    // Click create button
    await page.click('button:has-text("创建子管理员")');
    await expect(page.locator('h2:has-text("创建子管理员")')).toBeVisible();

    // Fill in username
    await page.fill('input[placeholder="例如：admin001"]', testUsername);

    // Fill in password
    await page.fill('input[placeholder="请输入密码"]', 'Test@123!');

    // Select some permissions - check the dish:view checkbox
    const dishViewCheckbox = page.locator('input#dish\\:view');
    await dishViewCheckbox.check();
    await expect(dishViewCheckbox).toBeChecked();

    // Also select canteen:view
    const canteenViewCheckbox = page.locator('input#canteen\\:view');
    await canteenViewCheckbox.check();
    await expect(canteenViewCheckbox).toBeChecked();

    // Handle success alert
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('成功');
      await dialog.accept();
    });

    // Click submit button (the one at the bottom of the form)
    await page.locator('button:has-text("创建子管理员")').last().click();

    // Wait for navigation back to list
    await expect(page.locator('h2:has-text("人员权限管理")')).toBeVisible({ timeout: 15000 });

    // Verify the new admin appears in the list
    await page.fill('input[placeholder="搜索用户名、角色（权限组合）..."]', testUsername);
    await page.waitForTimeout(500);
    await expect(page.locator(`td:has-text("${testUsername}")`)).toBeVisible({ timeout: 10000 });

    // Get the admin ID via API for cleanup
    const token = await getSuperAdminToken(request);
    expect(token).toBeTruthy();

    const adminsResponse = await request.get(`${baseURL}admin/admins?pageSize=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const admins = await adminsResponse.json();
    const createdAdmin = admins.data.items.find((a: any) => a.username === testUsername);
    expect(createdAdmin).toBeDefined();
    createdAdminId = createdAdmin.id;
  });

  test('should edit sub-admin permissions via UI', async ({ page }) => {
    test.setTimeout(60000);

    // This test depends on the previous test creating the admin
    expect(createdAdminId).toBeTruthy();

    await page.goto('/user-manage');
    await page.waitForLoadState('networkidle');

    // Search for the admin
    await page.fill('input[placeholder="搜索用户名、角色（权限组合）..."]', testUsername);
    await page.waitForTimeout(500);
    await expect(page.locator(`td:has-text("${testUsername}")`)).toBeVisible({ timeout: 10000 });

    // Find the row and click edit button (using the icon button with carbon:edit)
    const row = page.locator('tr', { hasText: testUsername });
    await row.locator('button:has(.iconify[data-icon="carbon:edit"])').click();

    // Verify edit form is displayed
    await expect(page.locator('h2:has-text("编辑子管理员")')).toBeVisible();

    // Verify username is disabled in edit mode
    const usernameInput = page.locator('input[placeholder="例如：admin001"]');
    await expect(usernameInput).toBeDisabled();
    expect(await usernameInput.inputValue()).toBe(testUsername);

    // Verify current permissions are checked
    const dishViewCheckbox = page.locator('input#dish\\:view');
    await expect(dishViewCheckbox).toBeChecked();

    // Add a new permission
    const dishCreateCheckbox = page.locator('input#dish\\:create');
    await dishCreateCheckbox.check();
    await expect(dishCreateCheckbox).toBeChecked();

    // Handle success alert
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('更新');
      await dialog.accept();
    });

    // Click save button
    await page.click('button:has-text("保存修改")');

    // Wait for navigation back to list
    await expect(page.locator('h2:has-text("人员权限管理")')).toBeVisible({ timeout: 15000 });
  });

  test('should delete sub-admin via UI', async ({ page }) => {
    test.setTimeout(60000);

    // This test depends on the previous tests
    expect(createdAdminId).toBeTruthy();

    await page.goto('/user-manage');
    await page.waitForLoadState('networkidle');

    // Search for the admin
    await page.fill('input[placeholder="搜索用户名、角色（权限组合）..."]', testUsername);
    await page.waitForTimeout(500);
    await expect(page.locator(`td:has-text("${testUsername}")`)).toBeVisible({ timeout: 10000 });

    // Find the row and click delete button
    const row = page.locator('tr', { hasText: testUsername });

    // Handle confirm dialog
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('确定要删除');
      await dialog.accept();
    });

    await row.locator('button:has(.iconify[data-icon="carbon:trash-can"])').click();

    // Handle success alert (if any)
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Wait for the admin to be removed from the list
    await page.waitForTimeout(1000);

    // Verify the admin is no longer in the list
    await page.fill('input[placeholder="搜索用户名、角色（权限组合）..."]', testUsername);
    await page.waitForTimeout(500);
    await expect(page.locator(`td:has-text("${testUsername}")`)).not.toBeVisible({ timeout: 5000 });

    // Clear the ID since it's deleted
    createdAdminId = '';
  });
});

/**
 * Admin Sub-Admin API Tests - Direct API Testing
 */
test.describe('Admin Sub-Admin API Tests', () => {
  test.describe.configure({ mode: 'serial' });

  let createdSubAdminId: string = '';

  test.beforeAll(async ({ request }) => {
    await cleanupTestAdmins(request);
  });

  test.afterEach(async ({ request }) => {
    if (createdSubAdminId) {
      const token = await getSuperAdminToken(request);
      if (token) {
        await deleteSubAdminViaApi(request, token, createdSubAdminId);
      }
      createdSubAdminId = '';
    }
  });

  test.afterAll(async ({ request }) => {
    await cleanupTestAdmins(request);
  });

  test('should create a new sub admin with superadmin via API', async ({ request }) => {
    const token = await getSuperAdminToken(request);
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
    expect(data.data.permissions).toEqual(expect.arrayContaining(createDto.permissions));
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
    const superToken = await getSuperAdminToken(request);
    if (superToken) {
      await deleteSubAdminViaApi(request, superToken, data.data.id);
    }
  });

  test('should return 400 for duplicate username via API', async ({ request }) => {
    const token = await getSuperAdminToken(request);
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
    const token = await getSuperAdminToken(request);
    expect(token).toBeTruthy();

    const createDto = {
      username: generateUsername('weak'),
      password: 'weak', // Too weak
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
    const token = await getSuperAdminToken(request);
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
    const token = await getSuperAdminToken(request);
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

  test('should update sub admin permissions via API', async ({ request }) => {
    const token = await getSuperAdminToken(request);
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
    const token = await getSuperAdminToken(request);
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
    const superToken = await getSuperAdminToken(request);
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

  test('should delete sub admin via API', async ({ request }) => {
    const token = await getSuperAdminToken(request);
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
    const deleteResponse = await request.delete(`${baseURL}admin/admins/${adminId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(deleteResponse.status()).toBe(200);
    const deleteData = await deleteResponse.json();
    expect(deleteData.code).toBe(200);
    expect(deleteData.message).toBe('操作成功');
  });

  test('should return 404 for non-existent sub admin delete via API', async ({ request }) => {
    const token = await getSuperAdminToken(request);
    expect(token).toBeTruthy();

    const response = await request.delete(`${baseURL}admin/admins/non-existent-id`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(404);
  });

  test('should return 403 when normal admin deletes sub admin via API', async ({ request }) => {
    const superToken = await getSuperAdminToken(request);
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
test.describe('Admin Manager Permission Tests', () => {
  test.describe.configure({ mode: 'serial' });

  let createdByManagerId: string = '';

  test.beforeAll(async ({ request }) => {
    await cleanupTestAdmins(request);
  });

  test.afterEach(async ({ request }) => {
    if (createdByManagerId) {
      try {
        // Use superadmin to delete
        const superToken = await getSuperAdminToken(request);
        if (superToken) {
          await deleteSubAdminViaApi(request, superToken, createdByManagerId);
        }
      } catch (error) {
        console.warn('Failed to clean up manager test admin:', error);
      }
      createdByManagerId = '';
    }
  });

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

  test('adminManager should NOT be able to update superadmin-created sub-admin via API', async ({ request }) => {
    // First, superadmin creates a sub-admin
    const superToken = await getSuperAdminToken(request);
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
    } finally {
      // Cleanup: superadmin deletes their own sub-admin
      await deleteSubAdminViaApi(request, superToken, superSubAdminId);
    }
  });

  test('adminManager should NOT be able to delete superadmin-created sub-admin via API', async ({ request }) => {
    // First, superadmin creates a sub-admin
    const superToken = await getSuperAdminToken(request);
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
      // Now adminManager tries to delete it - should fail
      const mgrToken = await getAdminManagerToken(request);
      expect(mgrToken).toBeTruthy();

      const deleteResponse = await request.delete(
        `${baseURL}admin/admins/${superSubAdminId}`,
        {
          headers: { Authorization: `Bearer ${mgrToken}` },
        }
      );

      expect(deleteResponse.status()).toBe(403);
    } finally {
      // Cleanup: superadmin deletes their own sub-admin
      await deleteSubAdminViaApi(request, superToken, superSubAdminId);
    }
  });

  test('adminManager should only see own sub-admins in list via API', async ({ request }) => {
    const mgrToken = await getAdminManagerToken(request);
    expect(mgrToken).toBeTruthy();

    const response = await request.get(`${baseURL}admin/admins`, {
      headers: { Authorization: `Bearer ${mgrToken}` },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.code).toBe(200);
    expect(data.data.items).toBeInstanceOf(Array);

    // All items should have createdBy set (meaning they are sub-admins, not original admins)
    for (const admin of data.data.items) {
      expect(admin.createdBy).toBeDefined();
    }
  });
});

/**
 * Role Selection and Permission Assignment Tests
 */
test.describe('Role and Permission Selection Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should auto-select permissions when selecting a role', async ({ page }) => {
    await page.goto('/user-manage');
    await page.waitForLoadState('networkidle');

    await page.click('button:has-text("创建子管理员")');
    await expect(page.locator('h2:has-text("创建子管理员")')).toBeVisible();

    // Initially no permissions should be checked
    const dishViewCheckbox = page.locator('input#dish\\:view');
    
    // Click on "后厨操作员" role
    await page.click('text=后厨操作员');

    // Verify that dish:view permission is now checked
    await expect(dishViewCheckbox).toBeChecked();

    // Verify canteen:view is also checked (it's in the role's default permissions)
    const canteenViewCheckbox = page.locator('input#canteen\\:view');
    await expect(canteenViewCheckbox).toBeChecked();
  });

  test('should allow selecting custom role', async ({ page }) => {
    await page.goto('/user-manage');
    await page.waitForLoadState('networkidle');

    await page.click('button:has-text("创建子管理员")');
    await expect(page.locator('h2:has-text("创建子管理员")')).toBeVisible();

    // Click on "自定义角色"
    await page.click('text=自定义角色');

    // Verify custom role input appears
    await expect(page.locator('input[placeholder="请输入自定义角色名称，例如：数据分析师、运营专员等"]')).toBeVisible();
  });

  test('should toggle all permissions in a group', async ({ page }) => {
    await page.goto('/user-manage');
    await page.waitForLoadState('networkidle');

    await page.click('button:has-text("创建子管理员")');
    await expect(page.locator('h2:has-text("创建子管理员")')).toBeVisible();

    // Find the "菜品管理" group and click its "全选" button
    const dishGroupSection = page.locator('div:has(h4:has-text("菜品管理"))');
    await dishGroupSection.locator('button:has-text("全选")').click();

    // Verify all dish permissions are checked
    await expect(page.locator('input#dish\\:view')).toBeChecked();
    await expect(page.locator('input#dish\\:create')).toBeChecked();
    await expect(page.locator('input#dish\\:edit')).toBeChecked();
    await expect(page.locator('input#dish\\:delete')).toBeChecked();

    // Click "取消全选" to uncheck all
    await dishGroupSection.locator('button:has-text("取消全选")').click();

    // Verify all dish permissions are unchecked
    await expect(page.locator('input#dish\\:view')).not.toBeChecked();
    await expect(page.locator('input#dish\\:create')).not.toBeChecked();
    await expect(page.locator('input#dish\\:edit')).not.toBeChecked();
    await expect(page.locator('input#dish\\:delete')).not.toBeChecked();
  });

  test('should toggle all permissions globally', async ({ page }) => {
    await page.goto('/user-manage');
    await page.waitForLoadState('networkidle');

    await page.click('button:has-text("创建子管理员")');
    await expect(page.locator('h2:has-text("创建子管理员")')).toBeVisible();

    // Click "全部全选" button
    await page.click('button:has-text("全部全选")');

    // Verify some permissions are checked
    await expect(page.locator('input#dish\\:view')).toBeChecked();
    await expect(page.locator('input#canteen\\:view')).toBeChecked();
    await expect(page.locator('input#news\\:view')).toBeChecked();

    // Click "取消全选" to uncheck all
    await page.click('button:has-text("取消全选")');

    // Verify permissions are unchecked
    await expect(page.locator('input#dish\\:view')).not.toBeChecked();
    await expect(page.locator('input#canteen\\:view')).not.toBeChecked();
    await expect(page.locator('input#news\\:view')).not.toBeChecked();
  });

  test('should show canteen selection dropdown', async ({ page }) => {
    await page.goto('/user-manage');
    await page.waitForLoadState('networkidle');

    await page.click('button:has-text("创建子管理员")');
    await expect(page.locator('h2:has-text("创建子管理员")')).toBeVisible();

    // Verify canteen select exists
    await expect(page.locator('select:has(option:has-text("全校食堂"))')).toBeVisible();
    
    // The dropdown should have canteens loaded
    const options = page.locator('select').first().locator('option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(1); // At least "全校食堂" + some canteens
  });
});
