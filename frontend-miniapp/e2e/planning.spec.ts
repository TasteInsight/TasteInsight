import { test, expect } from '@playwright/test';
import { installMockApi } from './helpers/mock-api';
import { defaultLoggedInSeed, gotoUniPage, seedUniStorage } from './helpers/uni';

test.describe('Planning', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page);
    await seedUniStorage(page, defaultLoggedInSeed);
  });

  test('shows empty states for current and historical plans', async ({ page }) => {
    await gotoUniPage(page, '/pages/planning/index');
    await page.getByRole('tab', { name: '列表', exact: true }).click();
    await expect(page.getByText('暂无当前规划')).toBeVisible();
    await page.getByLabel('选择列表范围', { exact: true }).click();
    await page
      .locator('.uni-picker-select .uni-picker-item')
      .filter({ hasText: /^历史规划$/ })
      .click();
    await expect(page.getByText('暂无历史规划')).toBeVisible();
  });

  test('creates and deletes a meal plan', async ({ page }) => {
    await gotoUniPage(page, '/pages/planning/index');
    await page.getByRole('tab', { name: '列表', exact: true }).click();
    await page.getByLabel('新建规划', { exact: true }).click();
    const editor = page.getByRole('dialog', { name: '新建规划', exact: true });
    await editor.getByLabel('选择食堂', { exact: true }).click();
    await page
      .locator('.uni-picker-select .uni-picker-item')
      .filter({ hasText: /^一食堂$/ })
      .click();
    await editor.getByLabel('选择窗口', { exact: true }).click();
    await page
      .locator('.uni-picker-select .uni-picker-item')
      .filter({ hasText: /^川味窗口$/ })
      .click();
    await editor.locator('.plan-result').filter({ hasText: '宫保鸡丁' }).click();
    await expect(editor.locator('.plan-selected-dish')).toContainText('宫保鸡丁');
    await editor.getByTestId('plan-save').click();
    await expect(editor).toBeHidden();
    await expect(page.locator('.meal-card')).toContainText('宫保鸡丁');

    // 重新进入页面，确认列表从接口读取已创建的规划。
    await gotoUniPage(page, '/pages/planning/index');
    await page.getByRole('tab', { name: '列表', exact: true }).click();
    await expect(page.locator('.meal-card')).toContainText('宫保鸡丁');
    await page.getByRole('button', { name: '删除规划', exact: true }).click();
    await page.locator('uni-modal .uni-modal__btn_primary').click();
    await expect(page.getByText('暂无当前规划')).toBeVisible();
    await gotoUniPage(page, '/pages/planning/index');
    await page.getByRole('tab', { name: '列表', exact: true }).click();
    await expect(page.getByText('暂无当前规划')).toBeVisible();
  });
});
