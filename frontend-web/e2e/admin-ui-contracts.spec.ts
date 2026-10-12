import { expect, test, type Page } from '@playwright/test'

const dish = {
  id: 'cm-long-stable-record-id-for-layout', name: '香菇青菜与杂粮饭', price: 16,
  canteenName: '第一食堂', windowName: '特色餐饮窗口', floorName: '一层',
  images: ['https://images.test/missing.png'], tags: ['家常菜'], averageRating: 4.5,
}

async function prepare(page: Page) {
  const writes: string[] = []
  await page.addInitScript(() => {
    sessionStorage.setItem('admin_token', 'style-contract-test')
    sessionStorage.setItem('admin_user', JSON.stringify({ id: 'ui-admin', username: '界面验收', role: 'admin' }))
    sessionStorage.setItem('admin_permissions', JSON.stringify([
      'dish:view', 'dish:create', 'dish:edit', 'dish:delete', 'canteen:view', 'canteen:create',
      'admin:view', 'admin:edit', 'news:view', 'news:create', 'report:handle', 'review:delete',
    ]))
  })
  const list = (items: unknown[]) => ({ code: 200, data: { items, meta: { page: 1, pageSize: 20, total: items.length, totalPages: 1 } } })
  await page.route('**/*', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.resourceType() === 'image' && request.url().includes('images.test')) {
      if (path.includes('missing')) return route.fulfill({ status: 404, body: '' })
      return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jh2kAAAAASUVORK5CYII=', 'base64') })
    }
    if (!['fetch', 'xhr'].includes(request.resourceType())) return route.continue()
    if (request.method() !== 'GET') { writes.push(path); return route.abort() }
    if (path.endsWith('/admin/dishes')) return route.fulfill({ json: list([dish]) })
    if (path.endsWith(`/admin/dishes/${dish.id}`)) return route.fulfill({ json: { code: 200, data: dish } })
    if (path.endsWith('/admin/admins')) return route.fulfill({ json: list([{ id: 'sub', username: '子管理员', role: 'admin', createdAt: '2026-10-09T10:00:00Z' }]) })
    if (path.endsWith('/admin/reports')) return route.fulfill({ json: list([{
      id: 'report', targetType: 'review', targetId: 'review', type: 'spam', reason: '内容核验',
      status: 'pending', createdAt: '2026-10-09T10:00:00Z', reporterNickname: '同学甲',
      reporter: { id: 'reporter', nickname: '同学甲', avatar: null },
      targetContent: { content: '评价原文', userId: 'author', userNickname: '同学乙', images: ['https://images.test/valid.png', 'https://images.test/missing.png'], isDeleted: false },
    }]) })
    return route.fulfill({ json: list([]) })
  })
  return writes
}

async function noPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
}

test('tables stay within the workspace at desktop and phone widths', async ({ page }) => {
  await prepare(page)
  await page.goto('/modify-dish')
  await expect(page.getByText(dish.name, { exact: true })).toBeVisible()
  for (const width of [1440, 1366, 1024, 820, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await noPageOverflow(page)
    await expect(page.locator('.admin-record-id')).toHaveAttribute('title', `菜品 ID：${dish.id}`)
  }
  await expect(page.getByRole('button', { name: '批量删除菜品', exact: true })).toHaveCount(0)
  await expect(page.locator('.admin-table img')).toHaveCount(0)
  await page.getByRole('button', { name: '展开管理菜单', exact: true }).click()
  await page.getByRole('link', { name: '新闻管理', exact: true }).click()
  await expect(page.getByRole('button', { name: '展开管理菜单', exact: true })).toBeVisible()
})

test('upload editors wrap rather than widening narrow forms', async ({ page }) => {
  const writes = await prepare(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/single-add')
  await expect(page.getByRole('heading', { name: '添加新菜品' })).toBeVisible()
  await noPageOverflow(page)
  await page.goto('/add-canteen')
  await page.getByRole('button', { name: '新建食堂', exact: true }).click()
  await expect(page.getByRole('heading', { name: '新建食堂' })).toBeVisible()
  await noPageOverflow(page)
  expect(writes).toEqual([])
})

test('modal keyboard focus cannot reach the background and cancellation restores the opener', async ({ page }) => {
  const writes = await prepare(page)
  await page.goto('/modify-dish')
  await page.getByRole('checkbox', { name: `选择菜品 ${dish.name}` }).check()
  const opener = page.getByRole('button', { name: '批量删除菜品', exact: true })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: '批量删除菜品', exact: true })
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate(el => el.matches(':modal'))).toBe(true)
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement?.closest('dialog[open]'))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
  expect(writes).toEqual([])
})

test('password reset is above the sidebar without allowing a business write', async ({ page }) => {
  const writes = await prepare(page)
  await page.goto('/user-manage')
  const opener = page.getByTitle('重置密码', { exact: true })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: '重置密码', exact: true })
  await expect(dialog).toBeVisible()
  expect(await page.evaluate(() => !!document.elementFromPoint(60, 200)?.closest('dialog'))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
  expect(writes).toEqual([])
})

test('Escape closes an editor tool panel without discarding the news draft', async ({ page }) => {
  const writes = await prepare(page)
  await page.goto('/news-manage')
  await page.getByRole('button', { name: '创建新闻', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '创建新闻', exact: true })
  await dialog.getByPlaceholder('请输入新闻标题', { exact: true }).fill('保留中的草稿')
  await dialog.locator('[contenteditable="true"]').fill('新闻正文')
  const insertLink = dialog.locator('button[data-menu-key="insertLink"]')
  await expect(insertLink).not.toHaveClass(/disabled/)
  await insertLink.click()
  const panel = dialog.locator('.w-e-modal:visible')
  await expect(panel).toBeVisible()
  await panel.locator('input').first().fill('链接文字')
  await panel.locator('input').first().press('Escape')
  await expect(panel).toBeHidden()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByPlaceholder('请输入新闻标题', { exact: true })).toHaveValue('保留中的草稿')
  await dialog.locator('button[data-menu-key="color"]').click()
  const colors = dialog.locator('.w-e-drop-panel:visible')
  await expect(colors).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(colors).toBeHidden()
  await expect(dialog.getByPlaceholder('请输入新闻标题', { exact: true })).toHaveValue('保留中的草稿')
  await expect(dialog.locator('[contenteditable="true"]')).toHaveText('新闻正文')
  expect(writes).toEqual([])
})

test('rapid editor tool switching retains both draft fields until all auxiliary panels close', async ({ page }) => {
  const writes = await prepare(page)
  await page.goto('/news-manage')
  await page.getByRole('button', { name: '创建新闻', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '创建新闻', exact: true })
  const title = dialog.getByPlaceholder('请输入新闻标题', { exact: true })
  const body = dialog.locator('[contenteditable="true"]')
  await title.fill('快速切换工具中的草稿')
  await body.fill('快速切换后保留的完整正文')
  await expect(dialog.locator('button[data-menu-key="color"]')).not.toHaveClass(/disabled/)
  await expect(dialog.locator('button[data-menu-key="bgColor"]')).not.toHaveClass(/disabled/)
  const switchInterval = await dialog.evaluate(element => {
    const first = element.querySelector<HTMLButtonElement>('button[data-menu-key="color"]')!
    const second = element.querySelector<HTMLButtonElement>('button[data-menu-key="bgColor"]')!
    first.click()
    const firstShownAt = performance.now()
    second.click()
    return performance.now() - firstShownAt
  })
  expect(switchInterval).toBeLessThan(200)
  const panels = dialog.locator('.w-e-drop-panel:visible')
  await expect(panels).toHaveCount(2)
  for (const remaining of [1, 0]) {
    await page.keyboard.press('Escape')
    await expect(panels).toHaveCount(remaining)
    await expect(dialog).toBeVisible()
    await expect(title).toHaveValue('快速切换工具中的草稿')
    await expect(body).toHaveText('快速切换后保留的完整正文')
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  expect(writes).toEqual([])
})

test('nested previews retain their top-layer order across KeepAlive navigation', async ({ page }) => {
  const writes = await prepare(page)
  await page.goto('/news-manage')
  await page.getByRole('link', { name: '举报管理', exact: true }).click()
  await page.getByRole('button', { name: '详情', exact: true }).click()
  const detail = page.getByRole('dialog', { name: '举报详情', exact: true })
  const openImage = detail.getByRole('button', { name: '预览评价图片 1', exact: true })
  await expect(openImage).toBeEnabled()
  await openImage.click()
  const image = page.getByRole('dialog', { name: '图片预览', exact: true })
  await expect(image).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: '新闻管理', exact: true })).toBeVisible()
  await page.goForward()
  await expect(image).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('dialog')?.getAttribute('aria-label'))).toBe('图片预览')
  await page.keyboard.press('ArrowRight')
  await expect(image.getByText('图片加载失败', { exact: true })).toBeVisible()
  const retry = image.getByRole('button', { name: '重新加载', exact: true })
  await expect(retry).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(image).toBeHidden()
  await expect(detail).toBeVisible()
  expect(writes).toEqual([])
})
