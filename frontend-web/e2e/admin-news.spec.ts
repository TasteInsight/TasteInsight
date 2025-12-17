import { test, expect, APIRequestContext } from '@playwright/test';
import { loginAsAdmin, getApiToken, TEST_ACCOUNTS, API_BASE_URL } from './utils';
import process from 'node:process';

// API base URL for direct API calls
const baseURL = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;

/**
 * Helper function to clean up test news created during tests
 */
async function cleanupTestNews(apiRequest: APIRequestContext) {
  try {
    const token = await getApiToken(
      apiRequest,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    if (!token) return;

    // Get all news
    const response = await apiRequest.get(`${baseURL}admin/news`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok()) {
      const data = await response.json();
      // Match test news with specific prefix
      const testNews = data.data.items.filter((n: any) =>
        n.title.startsWith('E2E Test') ||
        n.title.startsWith('API Test') ||
        n.title.startsWith('UI Test')
      );

      for (const news of testNews) {
        try {
          await apiRequest.delete(`${baseURL}admin/news/${news.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          console.log(`Cleaned up test news: ${news.title}`);
        } catch (e) {
          console.warn(`Failed to delete news ${news.id}:`, e);
        }
      }
    }
  } catch (error) {
    console.warn('Failed to cleanup test news:', error);
  }
}

/**
 * Admin News Management E2E Tests
 */
test.describe('Admin News Management', () => {
  // Run tests in this describe block serially to avoid conflicts
  test.describe.configure({ mode: 'serial' });

  let createdNewsId: string;

  // Clean up any leftover test data before running tests
  test.beforeAll(async ({ request }) => {
    await cleanupTestNews(request);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.afterEach(async ({ request }) => {
    // Cleanup: delete the test news if it was created
    if (createdNewsId) {
      try {
        const token = await getApiToken(
          request,
          TEST_ACCOUNTS.superAdmin.username,
          TEST_ACCOUNTS.superAdmin.password
        );
        if (token) {
          await request.delete(`${baseURL}admin/news/${createdNewsId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch (error) {
        console.warn('Failed to clean up test news:', error);
      }
      createdNewsId = '';
    }
  });

  // Also clean up after all tests
  test.afterAll(async ({ request }) => {
    await cleanupTestNews(request);
  });

  test('should display news list page correctly', async ({ page }) => {
    await page.goto('/news-manage');

    await expect(page.locator('h2:has-text("新闻管理")')).toBeVisible(); // Updated title
    await expect(page.locator('button:has-text("创建新闻")')).toBeVisible(); // Updated button text
    await expect(page.locator('th:has-text("标题")')).toBeVisible();
    await expect(page.locator('th:has-text("摘要")')).toBeVisible(); // Updated column
    await expect(page.locator('th:has-text("食堂")')).toBeVisible(); // Updated column
    await expect(page.locator('th:has-text("发布时间")')).toBeVisible();
    await expect(page.locator('th:has-text("操作")')).toBeVisible();
  });

  test('should create a new news via UI', async ({ page, request }) => {
    const newsTitle = `UI Test News ${Date.now()}`;
    const newsContent = 'This is a test news content created by UI test.';
    const newsSummary = 'Test Summary';

    await page.goto('/news-manage');
    await page.click('button:has-text("创建新闻")'); // Updated button text

    // Wait for modal or form
    await expect(page.locator('h3:has-text("创建新闻")')).toBeVisible();

    await page.fill('input[placeholder="请输入新闻标题"]', newsTitle);
    await page.fill('input[placeholder="请输入新闻摘要"]', newsSummary);
    
    // Fill content in wangEditor
    // wangEditor uses a contenteditable div, we can fill it by locating the editable area
    const editorSelector = '.w-e-text-container [contenteditable="true"]';
    await page.locator(editorSelector).click();
    await page.keyboard.type(newsContent);

    // Click submit (Immediate publish)
    await page.click('button:has-text("立即发布")');

    // Handle success alert
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Wait for list update and verify
    // Since we published, it should appear in the "Published" list (default view)
    await page.waitForSelector('table tbody tr', { state: 'visible' });
    
    // Verify news is in list
    await expect(page.locator('tr', { hasText: newsTitle })).toBeVisible();

    // Store ID for cleanup (fetch via API)
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    const response = await request.get(`${baseURL}admin/news`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { status: 'published' }
    });
    const data = await response.json();
    const createdNews = data.data.items.find((n: any) => n.title === newsTitle);
    if (createdNews) {
      createdNewsId = createdNews.id;
    }
  });

  test('should edit existing news via UI', async ({ page, request }) => {
    // First create a DRAFT news via API to edit
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    const createDto = {
      title: `UI Test Edit ${Date.now()}`,
      content: 'Original content',
      summary: 'Original summary',
      // status: 'draft' // Create as draft (default)
    };
    const createResponse = await request.post(`${baseURL}admin/news`, {
      headers: { Authorization: `Bearer ${token}` },
      data: createDto,
    });
    
    if (createResponse.status() !== 201 && createResponse.status() !== 200) {
        console.error('Create news response for edit test:', createResponse.status(), await createResponse.text());
    }
    expect([200, 201]).toContain(createResponse.status()); // Ensure creation was successful
    
    const createData = await createResponse.json();
    if (!createData.data || !createData.data.id) {
        console.error('Create news response:', createData);
        throw new Error('Failed to create news for edit test');
    }
    createdNewsId = createData.data.id;

    await page.goto('/news-manage');
    
    // Switch to Draft tab
    await page.click('button:has-text("未发布 (草稿)")');
    // waitForSelector with text content should use :has-text psuedo-class in selector, not as option
    await page.waitForSelector(`tr:has-text("${createDto.title}")`);

    // Click edit button
    const row = page.locator('tr', { hasText: createDto.title });
    await row.locator('button[title="编辑"]').click();

    // Wait for form
    await expect(page.locator('h3:has-text("编辑新闻")')).toBeVisible();

    // Update content
    const newSummary = 'Updated summary via UI';
    await page.fill('input[placeholder="请输入新闻摘要"]', newSummary);
    
    // Update editor content
    const editorSelector = '.w-e-text-container [contenteditable="true"]';
    await page.locator(editorSelector).clear();
    await page.locator(editorSelector).fill('Updated content via UI');

    await page.click('button:has-text("保存为草稿")');

    // Handle success alert
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Verify update in draft list
    await expect(page.locator('tr', { hasText: createDto.title })).toBeVisible();
    // Ideally verify summary update if visible in table
  });

  test('should delete news via UI', async ({ page, request }) => {
    // First create a DRAFT news via API to delete
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    const createDto = {
      title: `UI Test Delete ${Date.now()}`,
      content: 'Content to delete',
      summary: 'Summary to delete',
      // status: 'draft' // Removed status field as it's likely not allowed in create DTO
    };
    const createResponse = await request.post(`${baseURL}admin/news`, {
      headers: { Authorization: `Bearer ${token}` },
      data: createDto,
    });
    
    if (createResponse.status() !== 201 && createResponse.status() !== 200) {
        console.error('Create news response for delete test:', createResponse.status(), await createResponse.text());
    }
    expect([200, 201]).toContain(createResponse.status()); // Ensure creation was successful
    
    const createData = await createResponse.json();
    if (!createData.data || !createData.data.id) {
        console.error('Create news response for delete:', createData);
        throw new Error('Failed to create news for delete test');
    }
    const newsId = createData.data.id;

    await page.goto('/news-manage');
    
    // Switch to Draft tab
    await page.click('button:has-text("未发布 (草稿)")');
    await page.waitForSelector(`tr:has-text("${createDto.title}")`);

    // Click delete
    const row = page.locator('tr', { hasText: createDto.title });
    
    // Mock window.confirm
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    
    await row.locator('button[title="删除"]').click();

    // Wait for deletion and success alert
    // Note: The UI might show an alert after deletion success, we should handle it if 'dialog' event wasn't enough or if it's a separate alert
    // Since we accepted the confirm, we might get a "Success" alert
    // But page.on('dialog') handles all dialogs.
    
    // Wait for row to disappear
    await expect(page.locator('tr', { hasText: createDto.title })).not.toBeVisible();
  });
});

/**
 * Admin News API Tests
 */
test.describe('Admin News API Tests', () => {
  let createdNewsId: string;

  test.afterEach(async ({ request }) => {
    if (createdNewsId) {
      try {
        const token = await getApiToken(
          request,
          TEST_ACCOUNTS.superAdmin.username,
          TEST_ACCOUNTS.superAdmin.password
        );
        if (token) {
          await request.delete(`${baseURL}admin/news/${createdNewsId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch (e) {}
      createdNewsId = '';
    }
  });

  test('should create news via API', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    const createDto = {
      title: `API Test News ${Date.now()}`,
      content: 'API content',
      summary: 'API summary', // Added required field
      // status: 'draft' // Removed status field as it's likely not allowed in create DTO
    };
    const response = await request.post(`${baseURL}admin/news`, {
      headers: { Authorization: `Bearer ${token}` },
      data: createDto,
    });
    
    // Some APIs return 200 OK even for creation, or 400 if validation fails
    // If 400, it might be due to missing fields. Let's check response text.
    if (response.status() !== 201 && response.status() !== 200) {
        console.error('API create response:', response.status(), await response.text());
    }
    expect([200, 201]).toContain(response.status());
    const data = await response.json();
    createdNewsId = data.data.id;
    expect(data.data.title).toBe(createDto.title);
  });

  test('should get news list via API', async ({ request }) => {
    const token = await getApiToken(
      request,
      TEST_ACCOUNTS.superAdmin.username,
      TEST_ACCOUNTS.superAdmin.password
    );
    const response = await request.get(`${baseURL}admin/news`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.data.items).toBeInstanceOf(Array);
  });
});

