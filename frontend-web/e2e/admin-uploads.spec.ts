import { test, expect } from '@playwright/test';
import { loginAsAdmin, getApiToken, TEST_ACCOUNTS } from './utils';

// API base URL for direct API calls
const baseURL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/';

/**
 * Admin Uploads (Dish Review) E2E Tests
 * 
 * These tests cover the dish upload review functionality in the admin panel.
 * Based on backend tests in backend/test/admin-uploads.e2e-spec.ts
 * 
 * Test Data (from seed_docker.ts):
 * - 用户上传待审核菜品 (pending, canteen1)
 * - 管理员上传待审核菜品 (pending, canteen1)
 * - 第二食堂用户上传待审核菜品 (pending, canteen2)
 */

// Test-specific upload name prefix to identify test-created data
const TEST_UPLOAD_PREFIX = 'E2E_UPLOAD_TEST_';

/**
 * Helper: Get pending uploads from API
 */
async function getPendingUploads(request: any, token: string): Promise<any[]> {
  try {
    const response = await request.get(`${baseURL}admin/dishes/uploads/pending`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page: 1, pageSize: 100 },
    });
    if (response.ok()) {
      const data = await response.json();
      return data.data?.items || [];
    }
  } catch (error) {
    console.error('Failed to get pending uploads:', error);
  }
  return [];
}

/**
 * Helper: Get pending upload detail by ID
 */
async function getPendingUploadDetail(request: any, token: string, id: string): Promise<any | null> {
  try {
    const response = await request.get(`${baseURL}admin/dishes/uploads/pending/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok()) {
      const data = await response.json();
      return data.data || null;
    }
  } catch (error) {
    console.error('Failed to get pending upload detail:', error);
  }
  return null;
}

/**
 * Helper: Get all canteens from API
 */
async function getCanteens(request: any, token: string): Promise<any[]> {
  try {
    const response = await request.get(`${baseURL}admin/canteens`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page: 1, pageSize: 100 },
    });
    if (response.ok()) {
      const data = await response.json();
      return data.data?.items || [];
    }
  } catch (error) {
    console.error('Failed to get canteens:', error);
  }
  return [];
}

/**
 * Helper: Get windows for a canteen
 */
async function getWindows(request: any, token: string, canteenId: string): Promise<any[]> {
  try {
    const response = await request.get(`${baseURL}admin/windows`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page: 1, pageSize: 100, canteenId },
    });
    if (response.ok()) {
      const data = await response.json();
      return data.data?.items || [];
    }
  } catch (error) {
    console.error('Failed to get windows:', error);
  }
  return [];
}

/**
 * Helper: Create a test dish upload via API
 */
async function createTestUpload(
  request: any, 
  token: string, 
  canteenName: string, 
  windowName: string,
  uploadName: string
): Promise<string | null> {
  try {
    const response = await request.post(`${baseURL}admin/dishes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: uploadName,
        price: 18.0,
        canteenName,
        windowName,
        description: 'E2E test upload - will be cleaned up',
        tags: ['测试'],
      },
    });
    if (response.status() === 201) {
      const data = await response.json();
      return data.data?.id || null;
    }
  } catch (error) {
    console.error('Failed to create test upload:', error);
  }
  return null;
}

/**
 * Helper: Delete a dish by ID (for cleanup)
 */
async function deleteDish(request: any, token: string, id: string): Promise<boolean> {
  try {
    const response = await request.delete(`${baseURL}admin/dishes/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.ok();
  } catch (error) {
    console.error('Failed to delete dish:', error);
  }
  return false;
}

/**
 * Helper: Cleanup test-created uploads and dishes
 */
async function cleanupTestData(request: any, token: string): Promise<void> {
  try {
    // Get all pending uploads and clean up test-created ones
    const pendingUploads = await getPendingUploads(request, token);
    for (const upload of pendingUploads) {
      if (upload.name?.startsWith(TEST_UPLOAD_PREFIX)) {
        // Reject the upload to clean it up
        await request.post(`${baseURL}admin/dishes/uploads/${upload.id}/reject`, {
          headers: { Authorization: `Bearer ${token}` },
          data: { reason: 'E2E test cleanup' },
        });
      }
    }
    
    // Also clean up any test dishes that might have been approved
    const dishesResponse = await request.get(`${baseURL}admin/dishes`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page: 1, pageSize: 100 },
    });
    if (dishesResponse.ok()) {
      const dishesData = await dishesResponse.json();
      const dishes = dishesData.data?.items || [];
      for (const dish of dishes) {
        if (dish.name?.startsWith(TEST_UPLOAD_PREFIX)) {
          await deleteDish(request, token, dish.id);
        }
      }
    }
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}

/**
 * API-level tests for admin uploads functionality
 */
test.describe('Admin Uploads API Tests', () => {
  let superAdminToken: string;
  let normalAdminToken: string;
  let reviewerAdminToken: string;
  let canteenAdminToken: string;

  test.beforeAll(async ({ request }) => {
    // Get tokens for different admin roles
    superAdminToken = (await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    )) || '';
    expect(superAdminToken).toBeTruthy();

    normalAdminToken = (await getApiToken(
      request,
      TEST_ACCOUNTS.normalAdmin.username,
      TEST_ACCOUNTS.normalAdmin.password
    )) || '';
    expect(normalAdminToken).toBeTruthy();

    // Get reviewer admin token (has upload:approve permission)
    reviewerAdminToken = (await getApiToken(
      request,
      'revieweradmin',
      'reviewer123'
    )) || '';

    // Get canteen admin token
    canteenAdminToken = (await getApiToken(
      request,
      TEST_ACCOUNTS.canteenAdmin.username,
      TEST_ACCOUNTS.canteenAdmin.password
    )) || '';

    // Cleanup any leftover test data
    await cleanupTestData(request, superAdminToken);
  });

  test.afterAll(async ({ request }) => {
    // Final cleanup
    await cleanupTestData(request, superAdminToken);
  });

  test.describe('/admin/dishes/uploads/pending (GET)', () => {
    test('should return pending uploads for super admin', async ({ request }) => {
      const response = await request.get(`${baseURL}admin/dishes/uploads/pending`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
        params: { page: 1, pageSize: 20 },
      });

      expect(response.ok()).toBe(true);
      const data = await response.json();
      
      expect(data.code).toBe(200);
      expect(data.message).toBe('success');
      expect(data.data).toBeDefined();
      expect(data.data.items).toBeInstanceOf(Array);
      expect(data.data.meta).toBeDefined();
      expect(data.data.meta.page).toBe(1);
      expect(data.data.meta.pageSize).toBe(20);

      // Verify all returned items have pending status
      for (const upload of data.data.items) {
        expect(upload.status).toBe('pending');
      }
    });

    test('should return pending uploads with pagination params', async ({ request }) => {
      const response = await request.get(`${baseURL}admin/dishes/uploads/pending`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
        params: { page: 1, pageSize: 5 },
      });

      expect(response.ok()).toBe(true);
      const data = await response.json();
      
      expect(data.data.meta.page).toBe(1);
      expect(data.data.meta.pageSize).toBe(5);
      expect(data.data.items.length).toBeLessThanOrEqual(5);
    });

    test('should return pending uploads for reviewer admin with upload:approve permission', async ({ request }) => {
      test.skip(!reviewerAdminToken, 'Reviewer admin account not available');

      const response = await request.get(`${baseURL}admin/dishes/uploads/pending`, {
        headers: { Authorization: `Bearer ${reviewerAdminToken}` },
      });

      expect(response.ok()).toBe(true);
      const data = await response.json();
      expect(data.code).toBe(200);
      expect(data.data.items).toBeInstanceOf(Array);
    });

    test('should return 401 without auth token', async ({ request }) => {
      const response = await request.get(`${baseURL}admin/dishes/uploads/pending`);
      expect(response.status()).toBe(401);
    });

    test('should return 403 for admin without upload:approve permission', async ({ request }) => {
      const response = await request.get(`${baseURL}admin/dishes/uploads/pending`, {
        headers: { Authorization: `Bearer ${normalAdminToken}` },
      });
      expect(response.status()).toBe(403);
    });

    test('should include uploader information in response', async ({ request }) => {
      const response = await request.get(`${baseURL}admin/dishes/uploads/pending`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.ok()).toBe(true);
      const data = await response.json();
      
      if (data.data.items.length > 0) {
        const upload = data.data.items[0];
        expect(upload).toHaveProperty('uploaderType');
        expect(upload).toHaveProperty('uploaderName');
        expect(['user', 'admin']).toContain(upload.uploaderType);
      }
    });

    test('should include dish details in response', async ({ request }) => {
      const response = await request.get(`${baseURL}admin/dishes/uploads/pending`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.ok()).toBe(true);
      const data = await response.json();
      
      if (data.data.items.length > 0) {
        const upload = data.data.items[0];
        expect(upload).toHaveProperty('id');
        expect(upload).toHaveProperty('name');
        expect(upload).toHaveProperty('price');
        expect(upload).toHaveProperty('canteenId');
        expect(upload).toHaveProperty('canteenName');
        expect(upload).toHaveProperty('windowName');
        expect(upload).toHaveProperty('status');
        expect(upload).toHaveProperty('createdAt');
      }
    });
  });

  test.describe('/admin/dishes/uploads/pending/:id (GET)', () => {
    test('should return pending upload detail for super admin', async ({ request }) => {
      // First get a pending upload ID
      const uploads = await getPendingUploads(request, superAdminToken);
      test.skip(uploads.length === 0, 'No pending uploads available for testing');

      const uploadId = uploads[0].id;
      const response = await request.get(`${baseURL}admin/dishes/uploads/pending/${uploadId}`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.ok()).toBe(true);
      const data = await response.json();
      
      expect(data.code).toBe(200);
      expect(data.message).toBe('success');
      expect(data.data).toBeDefined();
      expect(data.data.id).toBe(uploadId);
    });

    test('should return pending upload detail with all fields', async ({ request }) => {
      const uploads = await getPendingUploads(request, superAdminToken);
      test.skip(uploads.length === 0, 'No pending uploads available for testing');

      const uploadId = uploads[0].id;
      const response = await request.get(`${baseURL}admin/dishes/uploads/pending/${uploadId}`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.ok()).toBe(true);
      const data = await response.json();
      const upload = data.data;
      
      expect(upload).toHaveProperty('id');
      expect(upload).toHaveProperty('name');
      expect(upload).toHaveProperty('tags');
      expect(upload).toHaveProperty('price');
      expect(upload).toHaveProperty('description');
      expect(upload).toHaveProperty('images');
      expect(upload).toHaveProperty('ingredients');
      expect(upload).toHaveProperty('allergens');
      expect(upload).toHaveProperty('spicyLevel');
      expect(upload).toHaveProperty('sweetness');
      expect(upload).toHaveProperty('saltiness');
      expect(upload).toHaveProperty('oiliness');
      expect(upload).toHaveProperty('canteenId');
      expect(upload).toHaveProperty('canteenName');
      expect(upload).toHaveProperty('windowId');
      expect(upload).toHaveProperty('windowName');
      expect(upload).toHaveProperty('availableMealTime');
      expect(upload).toHaveProperty('status');
      expect(upload).toHaveProperty('uploaderType');
      expect(upload).toHaveProperty('uploaderName');
      expect(upload).toHaveProperty('createdAt');
      expect(upload).toHaveProperty('updatedAt');
    });

    test('should return 404 for non-existent upload', async ({ request }) => {
      const response = await request.get(`${baseURL}admin/dishes/uploads/pending/non-existent-id`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.status()).toBe(404);
      const data = await response.json();
      expect(data.message).toBe('上传记录不存在');
    });

    test('should return 401 without auth token', async ({ request }) => {
      const response = await request.get(`${baseURL}admin/dishes/uploads/pending/some-id`);
      expect(response.status()).toBe(401);
    });

    test('should return 403 for admin without upload:approve permission', async ({ request }) => {
      const uploads = await getPendingUploads(request, superAdminToken);
      test.skip(uploads.length === 0, 'No pending uploads available for testing');

      const uploadId = uploads[0].id;
      const response = await request.get(`${baseURL}admin/dishes/uploads/pending/${uploadId}`, {
        headers: { Authorization: `Bearer ${normalAdminToken}` },
      });

      expect(response.status()).toBe(403);
    });
  });

  test.describe('/admin/dishes/uploads/:id/approve (POST)', () => {
    let testUploadId: string | null = null;

    test.beforeAll(async ({ request }) => {
      // Create a test upload for approval testing
      const canteens = await getCanteens(request, superAdminToken);
      if (canteens.length > 0) {
        const canteen = canteens.find(c => c.name === '第一食堂') || canteens[0];
        const windows = await getWindows(request, superAdminToken, canteen.id);
        if (windows.length > 0) {
          const uniqueName = `${TEST_UPLOAD_PREFIX}APPROVE_${Date.now()}`;
          testUploadId = await createTestUpload(
            request, 
            superAdminToken, 
            canteen.name, 
            windows[0].name,
            uniqueName
          );
        }
      }
    });

    test.afterAll(async ({ request }) => {
      // Cleanup: delete any dishes created from the approved upload
      await cleanupTestData(request, superAdminToken);
    });

    test('should approve upload and create dish for super admin', async ({ request }) => {
      test.skip(!testUploadId, 'Failed to create test upload');

      const response = await request.post(`${baseURL}admin/dishes/uploads/${testUploadId}/approve`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.ok()).toBe(true);
      const data = await response.json();
      
      expect(data.code).toBe(200);
      expect(data.message).toBe('审核通过，菜品已入库');
    });

    test('should return 404 for non-existent upload', async ({ request }) => {
      const response = await request.post(`${baseURL}admin/dishes/uploads/non-existent-id/approve`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.status()).toBe(404);
    });

    test('should return 400 for already processed upload', async ({ request }) => {
      test.skip(!testUploadId, 'No test upload available');

      // The upload was already approved, so this should fail
      const response = await request.post(`${baseURL}admin/dishes/uploads/${testUploadId}/approve`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.status()).toBe(400);
    });

    test('should return 401 without auth token', async ({ request }) => {
      const response = await request.post(`${baseURL}admin/dishes/uploads/some-id/approve`);
      expect(response.status()).toBe(401);
    });

    test('should return 403 for admin without upload:approve permission', async ({ request }) => {
      const uploads = await getPendingUploads(request, superAdminToken);
      test.skip(uploads.length === 0, 'No pending uploads available');

      const response = await request.post(`${baseURL}admin/dishes/uploads/${uploads[0].id}/approve`, {
        headers: { Authorization: `Bearer ${normalAdminToken}` },
      });

      expect(response.status()).toBe(403);
    });
  });

  test.describe('/admin/dishes/uploads/:id/reject (POST)', () => {
    let testUploadId: string | null = null;

    test.beforeAll(async ({ request }) => {
      // Create a test upload for rejection testing
      const canteens = await getCanteens(request, superAdminToken);
      if (canteens.length > 0) {
        const canteen = canteens.find(c => c.name === '第一食堂') || canteens[0];
        const windows = await getWindows(request, superAdminToken, canteen.id);
        if (windows.length > 0) {
          const uniqueName = `${TEST_UPLOAD_PREFIX}REJECT_${Date.now()}`;
          testUploadId = await createTestUpload(
            request, 
            superAdminToken, 
            canteen.name, 
            windows[0].name,
            uniqueName
          );
        }
      }
    });

    test.afterAll(async ({ request }) => {
      await cleanupTestData(request, superAdminToken);
    });

    test('should reject upload for super admin', async ({ request }) => {
      test.skip(!testUploadId, 'Failed to create test upload');

      const response = await request.post(`${baseURL}admin/dishes/uploads/${testUploadId}/reject`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
        data: { reason: 'E2E测试拒绝原因' },
      });

      expect(response.ok()).toBe(true);
      const data = await response.json();
      
      expect(data.code).toBe(200);
      expect(data.message).toBe('已拒绝');
    });

    test('should return 400 when reason is missing', async ({ request }) => {
      const uploads = await getPendingUploads(request, superAdminToken);
      test.skip(uploads.length === 0, 'No pending uploads available');

      const response = await request.post(`${baseURL}admin/dishes/uploads/${uploads[0].id}/reject`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
        data: {},
      });

      expect(response.status()).toBe(400);
    });

    test('should return 400 when reason is empty string', async ({ request }) => {
      const uploads = await getPendingUploads(request, superAdminToken);
      test.skip(uploads.length === 0, 'No pending uploads available');

      const response = await request.post(`${baseURL}admin/dishes/uploads/${uploads[0].id}/reject`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
        data: { reason: '' },
      });

      expect(response.status()).toBe(400);
    });

    test('should return 404 for non-existent upload', async ({ request }) => {
      const response = await request.post(`${baseURL}admin/dishes/uploads/non-existent-id/reject`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
        data: { reason: '不存在' },
      });

      expect(response.status()).toBe(404);
    });

    test('should return 400 for already processed upload', async ({ request }) => {
      test.skip(!testUploadId, 'No test upload available');

      // The upload was already rejected, so this should fail
      const response = await request.post(`${baseURL}admin/dishes/uploads/${testUploadId}/reject`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
        data: { reason: '再次拒绝' },
      });

      expect(response.status()).toBe(400);
    });

    test('should return 401 without auth token', async ({ request }) => {
      const response = await request.post(`${baseURL}admin/dishes/uploads/some-id/reject`, {
        data: { reason: '测试' },
      });
      expect(response.status()).toBe(401);
    });

    test('should return 403 for admin without upload:approve permission', async ({ request }) => {
      const uploads = await getPendingUploads(request, superAdminToken);
      test.skip(uploads.length === 0, 'No pending uploads available');

      const response = await request.post(`${baseURL}admin/dishes/uploads/${uploads[0].id}/reject`, {
        headers: { Authorization: `Bearer ${normalAdminToken}` },
        data: { reason: '测试' },
      });

      expect(response.status()).toBe(403);
    });
  });

  test.describe('Reviewer Admin Tests', () => {
    let testApproveUploadId: string | null = null;
    let testRejectUploadId: string | null = null;

    test.beforeAll(async ({ request }) => {
      test.skip(!reviewerAdminToken, 'Reviewer admin account not available');

      // Create test uploads for reviewer testing
      const canteens = await getCanteens(request, superAdminToken);
      if (canteens.length > 0) {
        const canteen = canteens.find(c => c.name === '第一食堂') || canteens[0];
        const windows = await getWindows(request, superAdminToken, canteen.id);
        if (windows.length > 0) {
          const approveUniqueName = `${TEST_UPLOAD_PREFIX}REVIEWER_APPROVE_${Date.now()}`;
          testApproveUploadId = await createTestUpload(
            request, 
            superAdminToken, 
            canteen.name, 
            windows[0].name,
            approveUniqueName
          );

          const rejectUniqueName = `${TEST_UPLOAD_PREFIX}REVIEWER_REJECT_${Date.now()}`;
          testRejectUploadId = await createTestUpload(
            request, 
            superAdminToken, 
            canteen.name, 
            windows[0].name,
            rejectUniqueName
          );
        }
      }
    });

    test.afterAll(async ({ request }) => {
      await cleanupTestData(request, superAdminToken);
    });

    test('should allow reviewer admin to approve upload', async ({ request }) => {
      test.skip(!reviewerAdminToken, 'Reviewer admin account not available');
      test.skip(!testApproveUploadId, 'Failed to create test upload');

      const response = await request.post(`${baseURL}admin/dishes/uploads/${testApproveUploadId}/approve`, {
        headers: { Authorization: `Bearer ${reviewerAdminToken}` },
      });

      expect(response.ok()).toBe(true);
      const data = await response.json();
      expect(data.code).toBe(200);
      expect(data.message).toBe('审核通过，菜品已入库');
    });

    test('should allow reviewer admin to reject upload', async ({ request }) => {
      test.skip(!reviewerAdminToken, 'Reviewer admin account not available');
      test.skip(!testRejectUploadId, 'Failed to create test upload');

      const response = await request.post(`${baseURL}admin/dishes/uploads/${testRejectUploadId}/reject`, {
        headers: { Authorization: `Bearer ${reviewerAdminToken}` },
        data: { reason: '信息不完整' },
      });

      expect(response.ok()).toBe(true);
      const data = await response.json();
      expect(data.code).toBe(200);
      expect(data.message).toBe('已拒绝');
    });
  });
});

/**
 * UI-level tests for the Review Dish page
 */
test.describe('Admin Uploads UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should navigate to review dish page', async ({ page }) => {
    await page.goto('/review-dish');
    
    // Verify the page title/header (use h2 to target the header specifically, not sidebar)
    await expect(page.locator('h2:has-text("菜品审核")')).toBeVisible();
    await expect(page.getByText('审核待上线的菜品信息')).toBeVisible();
  });

  test('should display pending uploads list', async ({ page }) => {
    await page.goto('/review-dish');
    
    // Wait for the table to load
    await page.waitForSelector('table', { state: 'visible' });
    
    // Verify table headers
    await expect(page.locator('th:has-text("菜品信息")')).toBeVisible();
    await expect(page.locator('th:has-text("提交时间")')).toBeVisible();
    await expect(page.locator('th:has-text("提交人")')).toBeVisible();
    await expect(page.locator('th:has-text("状态")')).toBeVisible();
    await expect(page.locator('th:has-text("操作")')).toBeVisible();
  });

  test('should have search and filter functionality', async ({ page }) => {
    await page.goto('/review-dish');
    
    // Verify search input exists
    const searchInput = page.locator('input[placeholder="搜索菜品名称..."]');
    await expect(searchInput).toBeVisible();
    
    // Verify status filter exists
    const statusFilter = page.locator('select').first();
    await expect(statusFilter).toBeVisible();
  });

  test('should navigate to review detail page when clicking review button', async ({ page, request }) => {
    // First verify there are pending uploads via API
    const token = await getApiToken(request, TEST_ACCOUNTS.superAdmin.username, TEST_ACCOUNTS.superAdmin.password);
    const uploads = await getPendingUploads(request, token!);
    test.skip(uploads.length === 0, 'No pending uploads available for UI testing');

    await page.goto('/review-dish');
    
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { state: 'visible', timeout: 10000 });
    
    // Find and click the first review button
    const reviewButton = page.locator('button:has-text("审核")').first();
    if (await reviewButton.isVisible()) {
      await reviewButton.click();
      
      // Should navigate to detail page
      await page.waitForURL(/\/review-dish\/.+/);
      
      // Verify detail page elements
      await expect(page.locator('text=菜品审核详情')).toBeVisible();
    }
  });

  test('should display review detail page with all sections', async ({ page, request }) => {
    // Get a pending upload ID
    const token = await getApiToken(request, TEST_ACCOUNTS.superAdmin.username, TEST_ACCOUNTS.superAdmin.password);
    const uploads = await getPendingUploads(request, token!);
    test.skip(uploads.length === 0, 'No pending uploads available for UI testing');

    const uploadId = uploads[0].id;
    await page.goto(`/review-dish/${uploadId}`);
    
    // Wait for page to load
    await page.waitForSelector('text=菜品审核详情', { state: 'visible' });
    
    // Verify main sections (use exact match or label selector to avoid matching sidebar links)
    await expect(page.getByText('食堂信息', { exact: true })).toBeVisible();
    await expect(page.getByText('窗口信息', { exact: true })).toBeVisible();
    await expect(page.getByText('菜品名称', { exact: true })).toBeVisible();
    await expect(page.getByText('菜品描述', { exact: true })).toBeVisible();
    await expect(page.getByText('菜品图片', { exact: true })).toBeVisible();
    await expect(page.getByText('供应信息', { exact: true })).toBeVisible();
    await expect(page.getByText('供应时间', { exact: true })).toBeVisible();
    await expect(page.getByText('提交信息', { exact: true })).toBeVisible();
    
    // Verify action buttons
    await expect(page.locator('button:has-text("批准通过")')).toBeVisible();
    await expect(page.locator('button:has-text("拒绝审核")')).toBeVisible();
    await expect(page.locator('button:has-text("取消")')).toBeVisible();
  });

  test('should go back to list when clicking cancel', async ({ page, request }) => {
    // Get a pending upload ID
    const token = await getApiToken(request, TEST_ACCOUNTS.superAdmin.username, TEST_ACCOUNTS.superAdmin.password);
    const uploads = await getPendingUploads(request, token!);
    test.skip(uploads.length === 0, 'No pending uploads available for UI testing');

    const uploadId = uploads[0].id;
    await page.goto(`/review-dish/${uploadId}`);
    
    // Wait for page to load
    await page.waitForSelector('button:has-text("取消")', { state: 'visible' });
    
    // Click cancel
    await page.click('button:has-text("取消")');
    
    // Should navigate back to list
    await page.waitForURL(/\/review-dish$/);
  });
});

/**
 * Integration tests: Complete approve/reject workflow through UI
 */
test.describe('Admin Uploads Workflow Tests', () => {
  let testUploadIdForApproval: string | null = null;
  let testUploadIdForRejection: string | null = null;
  let superAdminToken: string;

  test.beforeAll(async ({ request }) => {
    superAdminToken = (await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    )) || '';
    expect(superAdminToken).toBeTruthy();

    // Clean up before creating new test data
    await cleanupTestData(request, superAdminToken);

    // Create test uploads for workflow testing
    const canteens = await getCanteens(request, superAdminToken);
    if (canteens.length > 0) {
      const canteen = canteens.find(c => c.name === '第一食堂') || canteens[0];
      const windows = await getWindows(request, superAdminToken, canteen.id);
      if (windows.length > 0) {
        const approveUniqueName = `${TEST_UPLOAD_PREFIX}WORKFLOW_APPROVE_${Date.now()}`;
        testUploadIdForApproval = await createTestUpload(
          request, 
          superAdminToken, 
          canteen.name, 
          windows[0].name,
          approveUniqueName
        );

        // Wait a bit to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 100));

        const rejectUniqueName = `${TEST_UPLOAD_PREFIX}WORKFLOW_REJECT_${Date.now()}`;
        testUploadIdForRejection = await createTestUpload(
          request, 
          superAdminToken, 
          canteen.name, 
          windows[0].name,
          rejectUniqueName
        );
      }
    }
  });

  test.afterAll(async ({ request }) => {
    await cleanupTestData(request, superAdminToken);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should approve a dish upload through UI', async ({ page }) => {
    test.skip(!testUploadIdForApproval, 'Failed to create test upload for approval');

    await page.goto(`/review-dish/${testUploadIdForApproval}`);
    
    // Wait for page to load
    await page.waitForSelector('button:has-text("批准通过")', { state: 'visible' });
    
    // Handle the confirm dialog
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });
    
    // Click approve button
    await page.click('button:has-text("批准通过")');
    
    // Should navigate back to list after approval
    await page.waitForURL(/\/review-dish(\?.*)?$/);
    
    // Mark as used so we don't try to use it again
    testUploadIdForApproval = null;
  });

  test('should reject a dish upload through UI', async ({ page }) => {
    test.skip(!testUploadIdForRejection, 'Failed to create test upload for rejection');

    await page.goto(`/review-dish/${testUploadIdForRejection}`);
    
    // Wait for page to load
    await page.waitForSelector('button:has-text("拒绝审核")', { state: 'visible' });
    
    // Handle the prompt dialog
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('E2E UI测试拒绝原因');
    });
    
    // Click reject button
    await page.click('button:has-text("拒绝审核")');
    
    // Should navigate back to list after rejection
    await page.waitForURL(/\/review-dish(\?.*)?$/);
    
    // Mark as used
    testUploadIdForRejection = null;
  });

  test('should search for uploads by name', async ({ page, request }) => {
    // Get pending uploads to have something to search for
    const token = await getApiToken(request, TEST_ACCOUNTS.superAdmin.username, TEST_ACCOUNTS.superAdmin.password);
    const uploads = await getPendingUploads(request, token!);
    test.skip(uploads.length === 0, 'No pending uploads available for search testing');

    await page.goto('/review-dish');
    
    // Wait for table to load
    await page.waitForSelector('table', { state: 'visible' });
    
    // Search for a specific upload name
    const searchInput = page.locator('input[placeholder="搜索菜品名称..."]');
    await searchInput.fill(uploads[0].name);
    
    // Wait for search to take effect (client-side filtering)
    await page.waitForTimeout(500);
    
    // Verify the search results contain the searched item
    const tableRows = page.locator('table tbody tr');
    const rowCount = await tableRows.count();
    
    // Should have at least one result if the search matches
    if (rowCount > 0) {
      await expect(page.locator(`table:has-text("${uploads[0].name}")`)).toBeVisible();
    }
  });

  test('should filter by status', async ({ page }) => {
    await page.goto('/review-dish');
    
    // Wait for table to load
    await page.waitForSelector('table', { state: 'visible' });
    
    // Select "待审核" status filter
    const statusFilter = page.locator('select').first();
    await statusFilter.selectOption('pending');
    
    // Wait for filter to take effect
    await page.waitForTimeout(500);
    
    // All visible items should have "待审核" status
    const statusBadges = page.locator('span.bg-yellow-100.text-yellow-800');
    const count = await statusBadges.count();
    
    // Verify all visible statuses are "待审核"
    for (let i = 0; i < count; i++) {
      await expect(statusBadges.nth(i)).toContainText('待审核');
    }
  });
});
