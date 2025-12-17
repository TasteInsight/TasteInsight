import { test, expect } from '@playwright/test';
import { loginAsAdmin, getApiToken, TEST_ACCOUNTS, API_BASE_URL } from './utils';
import process from 'node:process';

// API base URL for direct API calls
const baseURL = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;

/**
 * Admin Reviews Management E2E Tests
 * 
 * These tests cover the review management functionality in the admin panel.
 * Includes both API tests and UI tests for CommentManage.vue.
 */

/**
 * Helper: Get pending reviews from API
 */
async function getPendingReviews(request: any, token: string): Promise<any[]> {
  try {
    const response = await request.get(`${baseURL}admin/reviews/pending`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page: 1, pageSize: 100 },
    });
    if (response.ok()) {
      const data = await response.json();
      return data.data?.items || [];
    }
  } catch (error) {
    console.error('Failed to get pending reviews:', error);
  }
  return [];
}

test.describe('Admin Reviews UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should display comment management page', async ({ page }) => {
    await page.goto('/comment-manage');
    
    // Verify Header
    await expect(page.locator('h2:has-text("评论和评价管理")')).toBeVisible();
    
    // Verify layout elements
    await expect(page.locator('input[placeholder="搜索菜品名称..."]')).toBeVisible();
    await expect(page.locator('text=请选择一个菜品查看评价和评论')).toBeVisible();
  });

  test('should list dishes and allow selection', async ({ page, request }) => {
    await page.goto('/comment-manage');
    
    // Wait for dish list to load
    // Assuming there is at least one dish in the system. 
    // If not, we might need to create one or skip. 
    // We can check if "暂无菜品数据" is visible first.
    
    const noData = await page.locator('text=暂无菜品数据').isVisible();
    if (noData) {
      console.log('No dishes available to test selection');
      return;
    }

    // Wait for at least one dish item
    const dishItems = page.locator('.p-4.mb-2.border.rounded-lg');
    await expect(dishItems.first()).toBeVisible({ timeout: 10000 });
    
    // Find a dish with reviews > 0
    const count = await dishItems.count();
    let targetDishIndex = 0;
    
    for (let i = 0; i < count; i++) {
        const dish = dishItems.nth(i);
        const text = await dish.textContent();
        // Check for "评价数: X" where X > 0
        // Text might be like "评价数: 5" or just check if it contains non-zero number after "评价数:"
        if (text && /评价数:\s*[1-9]\d*/.test(text)) {
            targetDishIndex = i;
            console.log(`Found dish with reviews at index ${i}`);
            break;
        }
    }
    
    // Click the target dish
    await dishItems.nth(targetDishIndex).click();
    
    // Verify right side updates
    // Should show "评价和评论" header instead of placeholder
    await expect(page.locator('h3:has-text("评价和评论")')).toBeVisible();
    
    // Verify stats or empty state
    // "暂无评价" or review list
    const hasReviews = await page.locator('text=暂无评价').isVisible();
    if (!hasReviews) {
      // If reviews exist, we should see review items
      await expect(page.locator('.bg-white.border.rounded-xl').first()).toBeVisible();
    } else {
       console.log('Selected dish has no reviews (or seed data insufficient), verified empty state');
    }
  });
});

test.describe('Admin Reviews API Tests', () => {
  let superAdminToken: string;
  let normalAdminToken: string;
  let reviewerAdminToken: string;

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

    // Get reviewer admin token (has review:approve permission)
    reviewerAdminToken = (await getApiToken(
      request,
      'revieweradmin',
      'reviewer123'
    )) || '';
    // reviewerAdminToken might be empty if the account doesn't exist, which is fine
  });

  test.describe('/admin/reviews/pending (GET)', () => {
    test('should return pending reviews for super admin', async ({ request }) => {
      const response = await request.get(`${baseURL}admin/reviews/pending`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
        params: { page: 1, pageSize: 20 },
      });

      expect(response.ok()).toBe(true);
      const data = await response.json();
      
      expect(data.code).toBe(200);
      expect(data.data).toBeDefined();
      expect(data.data.items).toBeInstanceOf(Array);
      expect(data.data.meta).toBeDefined();
      expect(data.data.meta.page).toBe(1);
      expect(data.data.meta.pageSize).toBe(20);
      expect(typeof data.data.meta.total).toBe('number');
      expect(typeof data.data.meta.totalPages).toBe('number');
    });

    test('should return pending reviews for reviewer admin with permission', async ({ request }) => {
      // Skip if reviewer admin token is not available
      test.skip(!reviewerAdminToken, 'Reviewer admin account not available');

      const response = await request.get(`${baseURL}admin/reviews/pending`, {
        headers: { Authorization: `Bearer ${reviewerAdminToken}` },
        params: { page: 1, pageSize: 20 },
      });

      expect(response.ok()).toBe(true);
      const data = await response.json();
      expect(data.code).toBe(200);
      expect(data.data.items).toBeInstanceOf(Array);
    });

    test('should return 403 for normal admin without permission', async ({ request }) => {
      const response = await request.get(`${baseURL}admin/reviews/pending`, {
        headers: { Authorization: `Bearer ${normalAdminToken}` },
      });

      expect(response.status()).toBe(403);
    });

    test('should return 401 for unauthenticated request', async ({ request }) => {
      const response = await request.get(`${baseURL}admin/reviews/pending`);

      expect(response.status()).toBe(401);
    });

    test('should support pagination', async ({ request }) => {
      const response = await request.get(`${baseURL}admin/reviews/pending`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
        params: { page: 2, pageSize: 5 },
      });

      expect(response.ok()).toBe(true);
      const data = await response.json();
      
      expect(data.code).toBe(200);
      expect(data.data.meta.page).toBe(2);
      expect(data.data.meta.pageSize).toBe(5);
    });
  });

  test.describe('/admin/reviews/:id/approve (POST)', () => {
    test('should return 404 for non-existent review', async ({ request }) => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request.post(`${baseURL}admin/reviews/${nonExistentId}/approve`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.status()).toBe(404);
    });

    test('should return 403 for normal admin without permission', async ({ request }) => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request.post(`${baseURL}admin/reviews/${nonExistentId}/approve`, {
        headers: { Authorization: `Bearer ${normalAdminToken}` },
      });

      expect(response.status()).toBe(403);
    });

    test('should return 401 for unauthenticated request', async ({ request }) => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request.post(`${baseURL}admin/reviews/${nonExistentId}/approve`);

      expect(response.status()).toBe(401);
    });
  });

  test.describe('/admin/reviews/:id/reject (POST)', () => {
    test('should return 404 for non-existent review', async ({ request }) => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request.post(`${baseURL}admin/reviews/${nonExistentId}/reject`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
        data: { reason: '测试拒绝原因' },
      });

      expect(response.status()).toBe(404);
    });

    test('should return 400 if reason is missing', async ({ request }) => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request.post(`${baseURL}admin/reviews/${nonExistentId}/reject`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
        data: {},
      });

      expect(response.status()).toBe(400);
    });

    test('should return 403 for normal admin without permission', async ({ request }) => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request.post(`${baseURL}admin/reviews/${nonExistentId}/reject`, {
        headers: { Authorization: `Bearer ${normalAdminToken}` },
        data: { reason: '测试拒绝原因' },
      });

      expect(response.status()).toBe(403);
    });

    test('should return 401 for unauthenticated request', async ({ request }) => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request.post(`${baseURL}admin/reviews/${nonExistentId}/reject`, {
        data: { reason: '测试拒绝原因' },
      });

      expect(response.status()).toBe(401);
    });
  });

  test.describe('/admin/reviews/:id (DELETE)', () => {
    test('should return 404 for non-existent review', async ({ request }) => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request.delete(`${baseURL}admin/reviews/${nonExistentId}`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.status()).toBe(404);
    });

    test('should return 403 for normal admin without permission', async ({ request }) => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request.delete(`${baseURL}admin/reviews/${nonExistentId}`, {
        headers: { Authorization: `Bearer ${normalAdminToken}` },
      });

      expect(response.status()).toBe(403);
    });

    test('should return 401 for unauthenticated request', async ({ request }) => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request.delete(`${baseURL}admin/reviews/${nonExistentId}`);

      expect(response.status()).toBe(401);
    });
  });
});

/**
 * Integration tests that verify review operations using seed data.
 * These tests are designed to be idempotent and not depend on specific seed content.
 * Tests that modify data will be skipped if no pending reviews are available.
 */
test.describe('Admin Reviews Integration Tests', () => {
  let superAdminToken: string;

  test.beforeAll(async ({ request }) => {
    superAdminToken = (await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    )) || '';
    expect(superAdminToken).toBeTruthy();
  });

  test('pending review list should include expected fields when reviews exist', async ({ request }) => {
    const response = await request.get(`${baseURL}admin/reviews/pending`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
      params: { page: 1, pageSize: 10 },
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    
    expect(data.code).toBe(200);
    expect(data.data).toBeDefined();
    expect(data.data.items).toBeInstanceOf(Array);
    
    // If there are pending reviews, verify the structure (not content)
    if (data.data.items.length > 0) {
      const review = data.data.items[0];
      
      // Verify required fields exist
      expect(review).toHaveProperty('id');
      expect(review).toHaveProperty('dishId');
      expect(review).toHaveProperty('userId');
      expect(review).toHaveProperty('rating');
      expect(review).toHaveProperty('content');
      expect(review).toHaveProperty('status');
      expect(review).toHaveProperty('createdAt');
      expect(review).toHaveProperty('updatedAt');
      
      // Verify status is 'pending'
      expect(review.status).toBe('pending');
      
      // Verify rating is a valid number between 1-5
      expect(typeof review.rating).toBe('number');
      expect(review.rating).toBeGreaterThanOrEqual(1);
      expect(review.rating).toBeLessThanOrEqual(5);
      
      // Verify dish info is included
      expect(review).toHaveProperty('dishName');
    }
  });

  test('should approve a pending review when available', async ({ request }) => {
    // Get fresh list of pending reviews
    const freshPendingReviews = await getPendingReviews(request, superAdminToken);
    
    // Skip test if no pending reviews available
    test.skip(freshPendingReviews.length === 0, 'No pending reviews available for testing');

    const reviewToApprove = freshPendingReviews[0];
    
    const response = await request.post(`${baseURL}admin/reviews/${reviewToApprove.id}/approve`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.code).toBe(200);
    expect(data.message).toBe('审核通过');
  });

  test('should reject a pending review with reason when available', async ({ request }) => {
    // Get fresh list of pending reviews
    const freshPendingReviews = await getPendingReviews(request, superAdminToken);
    
    // Skip test if no pending reviews available
    test.skip(freshPendingReviews.length === 0, 'No pending reviews available for testing');

    const reviewToReject = freshPendingReviews[0];
    const reason = 'E2E测试拒绝原因';
    
    const response = await request.post(`${baseURL}admin/reviews/${reviewToReject.id}/reject`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
      data: { reason },
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.code).toBe(200);
    expect(data.message).toBe('已拒绝');
  });

  test('should delete a review (soft delete) when available', async ({ request }) => {
    // Get fresh list of pending reviews
    const freshPendingReviews = await getPendingReviews(request, superAdminToken);
    
    // Skip test if no pending reviews available
    test.skip(freshPendingReviews.length === 0, 'No pending reviews available for testing');

    const reviewToDelete = freshPendingReviews[0];
    
    const response = await request.delete(`${baseURL}admin/reviews/${reviewToDelete.id}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.code).toBe(200);
    expect(data.message).toBe('删除成功');
  });
});

