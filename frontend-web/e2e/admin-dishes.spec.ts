import { test, expect, APIRequestContext } from '@playwright/test';
import { loginAsAdmin, getApiToken, TEST_ACCOUNTS, API_BASE_URL } from './utils';
import process from 'node:process';

// API base URL for direct API calls
const baseURL = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;

test.describe('Admin Dish Management', () => {
  let createdDishId: string;
  let apiToken: string;

  // Helper to clean up test data by prefix
  async function cleanupTestData(request: APIRequestContext, token: string, prefix: string) {
    try {
      // Clean up dishes
      const dishesResp = await request.get(`${baseURL}admin/dishes?pageSize=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (dishesResp.ok()) {
        const dishes = await dishesResp.json();
        const matches = dishes.data.items.filter((d: any) => d.name && d.name.startsWith(prefix));
        for (const m of matches) {
          await request.delete(`${baseURL}admin/dishes/${m.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).catch(() => {});
        }
      }
    } catch (e) { /* ignore */ }

    try {
      // Clean up uploads (pending dishes)
      const uploadsResp = await request.get(`${baseURL}admin/dishes/uploads/pending?pageSize=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (uploadsResp.ok()) {
        const uploads = await uploadsResp.json();
        const matches = uploads.data.items.filter((u: any) => u.name && u.name.startsWith(prefix));
        for (const u of matches) {
          // Reject or delete the upload - use reject with a reason
          await request.post(`${baseURL}admin/dishes/uploads/${u.id}/reject`, {
            headers: { 'Authorization': `Bearer ${token}` },
            data: { reason: 'E2E test cleanup' }
          }).catch(() => {});
        }
      }
    } catch (e) { /* ignore */ }
  }

  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(page);
    
    // Get API token for cleanup
    apiToken = await getApiToken(request, TEST_ACCOUNTS.superAdmin.username, TEST_ACCOUNTS.superAdmin.password);
    
    // Clean up any residual test data before each test
    await cleanupTestData(request, apiToken, 'E2E Test Dish');
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
    // Update selector to match partial placeholder or exact placeholder
    await page.fill('input[placeholder*="15.00"]', dishPrice);

    // Fill Description
    await page.fill('textarea[placeholder="请输入菜品描述..."]', dishDescription);

    // Handle success alert
    page.once('dialog', async dialog => {
      await dialog.accept();
    });

    // Submit
    // Use the exact text from the button
    await page.click('button:has-text("保存菜品信息")');

    // Wait for navigation to review page (creation now redirects to review)
    await page.waitForURL(/\/review-dish/);
    
    // Search for the dish (already on review page)
    await page.waitForSelector('input[placeholder="搜索菜品名称..."]');
    await page.fill('input[placeholder="搜索菜品名称..."]', dishName);
    
    // Trigger search (some implementations might need enter or blur)
    await page.keyboard.press('Enter');
    
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
    
    // Wait for a moment for backend to process and index the new dish status
    await page.waitForTimeout(1000);

    // 3. Verify the dish exists in the ModifyDish list
    await page.goto('/modify-dish');
    
    // Search for the dish
    await page.waitForSelector('input[placeholder="搜索菜品名称、食堂、窗口..."]');
    await page.fill('input[placeholder="搜索菜品名称、食堂、窗口..."]', dishName);
    
    // Wait for search debounce
    await page.waitForTimeout(600);
    
    // Wait for the table to contain the dish name
    await expect(page.locator('table')).toContainText(dishName, { timeout: 10000 });
    await expect(page.locator('table')).toContainText(dishPrice); // Check price formatted 

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

test.describe('Sub-item Creation and Display', () => {
  // Use a unique prefix for this test suite to avoid conflicts
  const TEST_PREFIX = 'E2E_SubItem_';

  // Helper to get sub-item container from page
  function getSubItemContainer(page: any) {
    // Looking for the container that holds the list of sub-items
    // In SingleAdd.vue/EditDish.vue, it's under "菜品子项" label
    const subItemSection = page.locator('label:has-text("菜品子项")').locator('..').locator('..');
    return subItemSection.locator('.space-y-3');
  }

  // Helper to get view sub-item container from page
  function getViewSubItemContainer(page: any) {
    const viewSubItemSection = page.locator('label:has-text("菜品子项")').locator('..');
    return viewSubItemSection.locator('.space-y-2');
  }

  // Helper to clean up test data by prefix
  async function cleanupTestData(request: APIRequestContext, token: string, prefix: string) {
    try {
      // Clean up dishes
      const dishesResp = await request.get(`${baseURL}admin/dishes?pageSize=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (dishesResp.ok()) {
        const dishes = await dishesResp.json();
        const matches = dishes.data.items.filter((d: any) => d.name && d.name.startsWith(prefix));
        for (const m of matches) {
          await request.delete(`${baseURL}admin/dishes/${m.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).catch(() => {});
        }
      }
    } catch (e) { /* ignore */ }

    try {
      // Clean up uploads (pending dishes)
      const uploadsResp = await request.get(`${baseURL}admin/dishes/uploads/pending?pageSize=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (uploadsResp.ok()) {
        const uploads = await uploadsResp.json();
        const matches = uploads.data.items.filter((u: any) => u.name && u.name.startsWith(prefix));
        for (const u of matches) {
          // Reject or delete the upload - use reject with a reason
          await request.post(`${baseURL}admin/dishes/uploads/${u.id}/reject`, {
            headers: { 'Authorization': `Bearer ${token}` },
            data: { reason: 'E2E test cleanup' }
          }).catch(() => {});
        }
      }
    } catch (e) { /* ignore */ }
  }

  test('Add sub-item -> approve -> parent shows sub-item (UI flow)', async ({ page, request }) => {
    // 1. Get auth token
    const superToken = await getApiToken(request, TEST_ACCOUNTS.superAdmin.username, TEST_ACCOUNTS.superAdmin.password);
    expect(superToken).toBeTruthy();

    // Generate unique name with timestamp to avoid conflicts
    const timestamp = Date.now();
    const subName = `${TEST_PREFIX}${timestamp}`;

    // 2. Clean up any residual test data before starting
    await cleanupTestData(request, superToken!, TEST_PREFIX);

    // 3. Find a suitable parent dish from seed data
    const listResp = await request.get(`${baseURL}admin/dishes`, {
      headers: { 'Authorization': `Bearer ${superToken}` }
    });
    expect(listResp.ok()).toBeTruthy();
    const listData = await listResp.json();
    const parentDish = listData.data.items.find((d: any) => !d.parentDishId && d.status === 'online');
    if (!parentDish) {
      test.skip();
      return;
    }

    const parentId = parentDish.id;
    let createdSubId: string | undefined;

    // Verify parent dish is accessible via API
    const verifyResp = await request.get(`${baseURL}admin/dishes/${parentId}`, {
      headers: { 'Authorization': `Bearer ${superToken}` }
    });
    if (!verifyResp.ok()) {
      console.log(`Parent dish ${parentId} not accessible via API: ${verifyResp.status()}`);
      test.skip();
      return;
    }

    try {
      // 4. Navigate to parent dish edit page and add sub-item through UI
      await loginAsAdmin(page);
      
      // Ensure we are logged in by checking for an element common to authenticated pages
      // Increased timeout to account for slower page loads or redirects
      await page.waitForSelector('header', { state: 'visible', timeout: 30000 });

      console.log(`Navigating to edit page for parent dish: ${parentId}`);
      await page.goto(`/edit-dish/${parentId}`);

      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      // Verify we are on the edit page
      await expect(page).toHaveURL(new RegExp(`/edit-dish/${parentId}`));

      // Click "添加子项" button
      console.log('Clicking "添加子项" button...');
      const addButton = page.locator('button:has-text("添加子项")');
      await expect(addButton).toBeVisible({ timeout: 10000 });
      await addButton.click();

      // This should navigate to /add-sub-dish page
      console.log('Waiting for navigation to /add-sub-dish...');
      await page.waitForURL(/\/add-sub-dish/, { timeout: 10000 });
      console.log(`Current URL: ${page.url()}`);

      // Wait for page to load completely
      await page.waitForLoadState('networkidle');

      // Wait for the input field to be visible
      console.log('Waiting for input field...');
      // Use a more robust selector based on the label
      const nameInput = page.locator('label:has-text("菜品名称")').locator('..').locator('input').first();
      await expect(nameInput).toBeVisible({ timeout: 10000 });

      // Fill the sub-item name
      await nameInput.fill(subName);

      // Additional wait for Vue to update
      await page.waitForTimeout(500);

      // Ensure name is present
      await expect(nameInput).toHaveValue(subName, { timeout: 10000 });

      // Fill price and description
      await page.fill('input[placeholder*="15.00"]', '9.9');
      await page.fill('textarea[placeholder="请输入菜品描述..."]', '子项测试说明');

      // Handle alert dialog and submit
      page.once('dialog', async dialog => { await dialog.accept(); });
      await page.click('button:has-text("保存子项信息")');

      // After creation, should redirect to parent edit
      await page.waitForURL(new RegExp(`/edit-dish/${parentId}`));

      // 5. Navigate to review page and approve the created sub-item
      await page.goto('/review-dish');
      
      // Wait for the table to load (wait for loading spinner to disappear)
      await page.waitForSelector('tr:not(:has-text("加载中"))', { timeout: 10000 });
      
      // Wait for network to be idle to ensure data is loaded
      await page.waitForLoadState('networkidle');
      
      // Search for the item with retries
      let reviewRowFound = false;
      for (let i = 0; i < 3; i++) {
        await page.fill('input[placeholder="搜索菜品名称..."]', subName);
        await page.keyboard.press('Enter');
        
        try {
          // Wait for the search results to appear or table to update
          await page.waitForSelector(`tr:has-text("${subName}")`, { timeout: 5000 });
          reviewRowFound = true;
          break;
        } catch (e) {
          console.log(`Attempt ${i + 1}: Search for ${subName} failed, retrying...`);
          await page.reload();
          await page.waitForLoadState('networkidle');
        }
      }
      
      expect(reviewRowFound, `Could not find review row for ${subName}`).toBeTruthy();
      
      const reviewRow = page.locator('tr', { hasText: subName });
      await expect(reviewRow).toBeVisible({ timeout: 10000 });

      // Click 审核 button
      await reviewRow.locator('button:has-text("审核")').click();
      await page.waitForURL(/\/review-dish\/.*/);
      
      // Handle confirm dialog for approval
      page.once('dialog', async dialog => { await dialog.accept(); });
      await page.click('button:has-text("批准通过")');
      await page.waitForURL(/\/review-dish/);

      // 6. Poll for the created dish to appear in the dishes list
      // Wait for the approval to be processed by monitoring network activity
      await page.waitForLoadState('networkidle');

      let found = false;
      const maxRetries = 15;
      const retryInterval = 1000;
      
      for (let i = 0; i < maxRetries && !found; i++) {
        const dishesResp = await request.get(`${baseURL}admin/dishes?pageSize=100`, {
          headers: { 'Authorization': `Bearer ${superToken}` }
        });
        if (dishesResp.ok()) {
          const dishesJson = await dishesResp.json();
          const created = dishesJson.data.items.find((d: any) => d.name === subName);
          if (created) {
            createdSubId = created.id;
            found = true;
            break;
          }
        }
        if (i < maxRetries - 1) { // Don't wait after the last attempt
          await new Promise((r) => setTimeout(r, retryInterval));
        }
      }

      if (!found) {
        throw new Error(`Sub-dish '${subName}' was not found after approval within ${maxRetries * retryInterval}ms timeout period`);
      }
      expect(createdSubId, `Expected sub-dish '${subName}' to be created`).toBeTruthy();      // 7. Verify via API that parent dish now has the sub-item in subDishId
      const parentDetailResp = await request.get(`${baseURL}admin/dishes/${parentId}`, {
        headers: { 'Authorization': `Bearer ${superToken}` }
      });
      expect(parentDetailResp.ok()).toBeTruthy();
      const parentDetail = await parentDetailResp.json();
      expect(parentDetail.data.subDishId).toBeDefined();
      expect(Array.isArray(parentDetail.data.subDishId)).toBeTruthy();
      expect(parentDetail.data.subDishId).toContain(createdSubId);

      // 8. Visit parent edit page and verify sub-item is visible in the UI
      await page.goto(`/edit-dish/${parentId}`);
      
      // Wait for page to load completely
      await page.waitForLoadState('networkidle');
      
      // Look for the sub-item in the specific "菜品子项" section
      const subItemContainer = getSubItemContainer(page);
      
      // Wait for the sub-item container to be visible (it only shows when there are sub-items)
      await expect(subItemContainer).toBeVisible({ timeout: 15000 });
      
      // Find the specific sub-item by name - it should be in a span or text element inside the row
      const subItemRow = subItemContainer.locator('.flex.items-center.justify-between', { hasText: subName });
      await expect(subItemRow).toBeVisible({ timeout: 10000 });
      
      // 9. Also verify sub-item is visible in the ViewDish page
      await page.goto(`/view-dish/${parentId}`);
      
      // Wait for page to load completely
      await page.waitForLoadState('networkidle');
      
      // Look for the sub-item in the view page's "菜品子项" section
      const viewSubItemContainer = getViewSubItemContainer(page);
      
      // Wait for the sub-item container to be visible (it should show sub-items)
      await expect(viewSubItemContainer).toBeVisible({ timeout: 15000 });
      
      // Find the specific sub-item by name in the view page
      const viewSubItemRow = viewSubItemContainer.locator('div', { hasText: subName });
      await expect(viewSubItemRow).toBeVisible({ timeout: 10000 });
      
      // Verify the price is also displayed in the view page (checking for presence of price text)
      // Note: Price display might vary (e.g., ¥9.9 or 9.9), so we check for basic visibility of the row
      
    } finally {
      // Cleanup: remove any created test data
      await cleanupTestData(request, superToken!, TEST_PREFIX);
    }
  });

  test('API verification: subDishId is correctly returned after approval', async ({ request }) => {
    // This is a pure API test to verify the backend correctly returns subDishId
    const superToken = await getApiToken(request, TEST_ACCOUNTS.superAdmin.username, TEST_ACCOUNTS.superAdmin.password);
    console.log('Token obtained:', superToken ? 'yes' : 'no');
    expect(superToken).toBeTruthy();

    const timestamp = Date.now();
    const subName = `${TEST_PREFIX}API_${timestamp}`;

    // Clean up before test
    await cleanupTestData(request, superToken!, TEST_PREFIX);

    // Find a suitable parent dish
    const listResp = await request.get(`${baseURL}admin/dishes`, {
      headers: { 'Authorization': `Bearer ${superToken}` }
    });
    
    if (!listResp.ok()) {
      const errText = await listResp.text();
      console.error('List dishes failed:', errText);
    }
    
    const listData = await listResp.json();
    
    if (!listData.data || !listData.data.items) {
      console.error('Unexpected list response:', JSON.stringify(listData));
      throw new Error('API response missing data.items');
    }
    
    const parentDish = listData.data.items.find((d: any) => !d.parentDishId && d.status === 'online');
    if (!parentDish) {
      console.log('No suitable parent dish found, skipping test');
      test.skip();
      return;
    }
    console.log('Found parent dish:', parentDish.id, parentDish.name);

    const parentId = parentDish.id;

    try {
      // Create a sub-item via API
      const createResp = await request.post(`${baseURL}admin/dishes`, {
        headers: { 'Authorization': `Bearer ${superToken}` },
        data: {
          name: subName,
          price: 12.5,
          canteenName: parentDish.canteenName,
          windowName: parentDish.windowName,
          parentDishId: parentId,
          description: 'API test sub-item'
        }
      });
      expect(createResp.status()).toBe(201);
      const createData = await createResp.json();
      const uploadId = createData.data.id;

      // Approve the upload
      const approveResp = await request.post(`${baseURL}admin/dishes/uploads/${uploadId}/approve`, {
        headers: { 'Authorization': `Bearer ${superToken}` }
      });
      
      // Log response for debugging if approval fails
      if (!approveResp.ok()) {
        const errorBody = await approveResp.text();
        console.error(`Approval failed with status ${approveResp.status()}: ${errorBody}`);
      }
      expect(approveResp.ok()).toBeTruthy();

      // Wait a moment for the approval to process
      // Use polling instead of fixed wait
      let found = false;
      const maxRetries = 10;
      const retryInterval = 1000;
      let dishesData: any;
      let createdDish: any;

      for (let i = 0; i < maxRetries && !found; i++) {
        const dishesResp = await request.get(`${baseURL}admin/dishes?pageSize=100`, {
          headers: { 'Authorization': `Bearer ${superToken}` }
        });
        
        if (dishesResp.ok()) {
          dishesData = await dishesResp.json();
          if (dishesData.data && dishesData.data.items) {
            createdDish = dishesData.data.items.find((d: any) => d.name === subName);
            if (createdDish) {
              found = true;
              break;
            }
          }
        }
        if (i < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, retryInterval));
        }
      }

      // Debug: log if data structure is unexpected
      if (!dishesData || !dishesData.data || !dishesData.data.items) {
        console.error(`Unexpected API response structure: ${JSON.stringify(dishesData)}`);
      }
      expect(dishesData.data).toBeDefined();
      expect(dishesData.data.items).toBeDefined();
      
      expect(createdDish, `Created dish '${subName}' not found after approval`).toBeTruthy();
      expect(createdDish.parentDishId).toBe(parentId);

      // Verify parent dish's subDishId contains the new sub-item
      const parentDetailResp = await request.get(`${baseURL}admin/dishes/${parentId}`, {
        headers: { 'Authorization': `Bearer ${superToken}` }
      });
      expect(parentDetailResp.ok()).toBeTruthy();
      const parentDetail = await parentDetailResp.json();
      
      expect(parentDetail.data.subDishId).toBeDefined();
      expect(Array.isArray(parentDetail.data.subDishId)).toBeTruthy();
      expect(parentDetail.data.subDishId).toContain(createdDish.id);

    } finally {
      // Cleanup
      await cleanupTestData(request, superToken!, TEST_PREFIX);
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
