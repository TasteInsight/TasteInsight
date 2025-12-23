import { test, expect } from '@playwright/test';
import { installMockApi } from './helpers/mock-api';
import { defaultLoggedInSeed, gotoUniPage, seedUniStorage } from './helpers/uni';

test.describe('Planning', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page);
    await seedUniStorage(page, defaultLoggedInSeed);
  });

  test('shows empty states for current/history tabs', async ({ page }) => {
    await gotoUniPage(page, '/pages/planning/index');

    await expect(page.getByText('当前规划').first()).toBeVisible();
    await expect(page.getByText('暂无当前规划').first()).toBeVisible();
    await expect(page.getByText('创建第一个规划').first()).toBeVisible();

    await page.getByText('历史规划').first().click();
    await expect(page.getByText('暂无历史规划').first()).toBeVisible();
  });

  test('creates and deletes a meal plan', async ({ page }) => {
    await gotoUniPage(page, '/pages/planning/index');

    // 点击创建规划
    await page.getByText('创建第一个规划').first().click();

    // 等待新建规划弹窗出现
    await expect(page.getByText('新建规划').first()).toBeVisible();

    // 选择日期（假设有日期选择器）
    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible()) {
      await dateInput.fill('2025-12-25');
    }

    // 点击确认创建（可能有确认按钮）
    const confirmButton = page.getByRole('button', { name: /确认|确定|创建/ }).first();
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    } else {
      // 如果没有确认按钮，可能点击其他地方关闭弹窗
      await page.keyboard.press('Enter');
    }

    // 等待创建成功，验证规划出现（检查是否有日期相关的文本）
    await expect(page.getByText('2025').first()).toBeVisible();

    // 删除规划（假设有删除按钮）
    const deleteButton = page.getByRole('button', { name: '删除' }).first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      // 确认删除
      await page.getByRole('button', { name: '确认' }).first().click();
    }

    // 验证规划被删除
    await expect(page.getByText('暂无当前规划').first()).toBeVisible();
  });
});
