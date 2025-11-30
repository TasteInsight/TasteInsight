import { test, expect } from '@playwright/test';

test.describe('Admin Dish Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as superadmin
    await page.goto('/login');
    await page.fill('input#username', 'testadmin');
    await page.fill('input#password', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/single-add');
  });

  test('Create, View, and Delete a Dish', async ({ page }) => {
    const dishName = `E2E Test Dish ${Date.now()}`;
    const dishPrice = '15.5';
    const dishDescription = 'This is a test dish created by Playwright E2E test.';

    // 1. Create a new dish
    await page.goto('/single-add');
    
    // Select Canteen (assuming "第一食堂" exists from seed)
    // We need to wait for the select to be populated
    await page.waitForSelector('select', { state: 'visible' });
    // Select the first canteen (or by label if possible, but select options might load async)
    // Let's try to select by text content if possible, or just the first option
    const canteenSelect = page.locator('select').first();
    await canteenSelect.selectOption({ index: 1 }); // Select first available option (index 0 is disabled "选择食堂")

    // Wait for windows to load and select window
    // The second select is for window
    const windowSelect = page.locator('select').nth(1);
    await expect(windowSelect).toBeEnabled();
    await windowSelect.selectOption({ index: 1 }); // Select first available window

    // Fill Name
    await page.fill('input[placeholder="例如：水煮肉片"]', dishName);

    // Fill Price
    await page.fill('input[type="number"]', dishPrice);

    // Fill Description
    await page.fill('textarea', dishDescription);

    // Submit
    await page.click('button:has-text("保存菜品信息")');

    // Wait for success message or redirection
    await page.waitForTimeout(2000);

    // 2. Approve the dish in ReviewDish page
    await page.goto('/review-dish');
    
    // Search for the dish
    await page.fill('input[placeholder="搜索菜品名称..."]', dishName);
    await page.waitForTimeout(1000); // Wait for debounce

    // Find the row with the dish name
    const reviewRow = page.locator('tr', { hasText: dishName });
    await expect(reviewRow).toBeVisible();

    // Click "审核" button
    const reviewButton = reviewRow.locator('button:has-text("审核")');
    await reviewButton.click();

    // Wait for navigation to detail page
    await page.waitForURL(/\/review-dish\/.*/);

    // Handle confirm dialog for approval
    page.on('dialog', dialog => dialog.accept());

    // Click "批准通过" button
    await page.click('button:has-text("批准通过")');

    // Wait for navigation back or success
    await page.waitForTimeout(2000);

    // 3. Verify the dish exists in the ModifyDish list
    await page.goto('/modify-dish');
    
    // Search for the dish
    await page.fill('input[placeholder="搜索菜品名称、食堂、窗口..."]', dishName);
    
    // Wait for results
    await page.waitForTimeout(1000); // Wait for debounce/search

    // Verify the dish is in the table
    await expect(page.locator('table')).toContainText(dishName);
    await expect(page.locator('table')).toContainText(dishPrice);

    // 4. Verify Edit Button works
    // Find the row with the dish name
    const row = page.locator('tr', { hasText: dishName });
    
    // Click edit button in that row
    // The edit button has title="编辑"
    const editButton = row.locator('button[title="编辑"]');
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Verify navigation to edit page
    await page.waitForURL(/\/edit-dish\/.*/);
    await expect(page).toHaveURL(/\/edit-dish\/.*/);

    // Note: The backend supports deletion (DELETE /admin/dishes/:id), 
    // but the frontend ModifyDish.vue currently does not have a Delete button.
    // So we cannot test deletion via UI yet.
  });
});
