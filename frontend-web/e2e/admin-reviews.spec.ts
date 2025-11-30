import { test, expect } from '@playwright/test';
import { getApiToken, TEST_ACCOUNTS } from './utils';

// API base URL for direct API calls
const baseURL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/';

/**
 * Admin Reviews Management E2E Tests
 * 
 * These tests cover the review management functionality in the admin panel.
 * Based on backend tests in backend/test/admin-reviews.e2e-spec.ts
 * 
 * Note: The frontend currently does not have a dedicated review management page.
 * These tests focus on API-level testing to verify the backend integration.
 */

/**
 * Helper: Get a dish ID from the database for creating test reviews
 */
async function getTestDishId(request: any, token: string): Promise<string | null> {
  try {
    const response = await request.get(`${baseURL}admin/dishes`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page: 1, pageSize: 1 },
    });
    if (response.ok()) {
      const data = await response.json();
      if (data.data?.items?.length > 0) {
        return data.data.items[0].id;
      }
    }
  } catch (error) {
    console.error('Failed to get test dish ID:', error);
  }
  return null;
}

/**
 * Helper: Create a test review via API (using user token simulation)
 * Since we can't directly create reviews via admin API, we'll use the existing pending reviews
 * or create them via the reviews API if available
 */
async function createTestReview(
  request: any, 
  token: string, 
  dishId: string, 
  status: 'pending' | 'approved' | 'rejected' = 'pending'
): Promise<string | null> {
  // Note: The admin API doesn't have a direct create review endpoint.
  // In the backend tests, reviews are created directly via Prisma.
  // For E2E testing, we'll work with existing pending reviews or skip this helper.
  // This is a limitation of the current API design.
  return null;
}

/**
 * Helper: Get pending reviews
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

/**
 * Helper: Clean up test reviews created during tests
 */
async function cleanupTestReviews(request: any, reviewIds: string[], token: string) {
  for (const reviewId of reviewIds) {
    try {
      await request.delete(`${baseURL}admin/reviews/${reviewId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

test.describe('Admin Reviews API Tests', () => {
  let superAdminToken: string;
  let normalAdminToken: string;
  let reviewerAdminToken: string;
  const createdReviewIds: string[] = [];

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

  test.afterAll(async ({ request }) => {
    // Clean up any test reviews we created
    if (superAdminToken && createdReviewIds.length > 0) {
      await cleanupTestReviews(request, createdReviewIds, superAdminToken);
    }
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
 * Integration tests that use pre-seeded pending reviews in the database.
 * These tests expect the seed_docker.ts to have created 3 pending reviews.
 */
test.describe('Admin Reviews Integration Tests', () => {
  let superAdminToken: string;
  let pendingReviews: any[] = [];

  test.beforeAll(async ({ request }) => {
    superAdminToken = (await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    )) || '';
    expect(superAdminToken).toBeTruthy();

    // Get current pending reviews
    pendingReviews = await getPendingReviews(request, superAdminToken);
  });

  test('should have pending reviews from seed data', async ({ request }) => {
    const response = await request.get(`${baseURL}admin/reviews/pending`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
      params: { page: 1, pageSize: 10 },
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    
    expect(data.code).toBe(200);
    expect(data.data.items.length).toBeGreaterThan(0);
    
    // Verify we have the seeded pending reviews
    const reviews = data.data.items;
    const hasGongbaoReview = reviews.some((r: any) => r.content.includes('宫保鸡丁'));
    expect(hasGongbaoReview).toBe(true);
  });

  test('pending review list should include expected fields', async ({ request }) => {
    const response = await request.get(`${baseURL}admin/reviews/pending`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
      params: { page: 1, pageSize: 10 },
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    
    expect(data.code).toBe(200);
    expect(data.data.items.length).toBeGreaterThan(0);
    
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
    
    // Verify rating is a valid number
    expect(typeof review.rating).toBe('number');
    expect(review.rating).toBeGreaterThanOrEqual(1);
    expect(review.rating).toBeLessThanOrEqual(5);
    
    // Verify dish info is included
    expect(review).toHaveProperty('dishName');
  });

  test('should approve a pending review', async ({ request }) => {
    // Get fresh list of pending reviews
    const freshPendingReviews = await getPendingReviews(request, superAdminToken);
    expect(freshPendingReviews.length).toBeGreaterThan(0);

    const reviewToApprove = freshPendingReviews[0];
    
    const response = await request.post(`${baseURL}admin/reviews/${reviewToApprove.id}/approve`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.code).toBe(200);
    expect(data.message).toBe('审核通过');
  });

  test('should reject a pending review with reason', async ({ request }) => {
    // Get fresh list of pending reviews
    const freshPendingReviews = await getPendingReviews(request, superAdminToken);
    expect(freshPendingReviews.length).toBeGreaterThan(0);

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

  test('should delete a review (soft delete)', async ({ request }) => {
    // Get fresh list of pending reviews
    const freshPendingReviews = await getPendingReviews(request, superAdminToken);
    expect(freshPendingReviews.length).toBeGreaterThan(0);

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
