import { expect, test } from '@playwright/test'

const resources = [
  { endpoint: 'dishes', label: '菜品', path: '/modify-dish', selectAll: '全选当前页菜品', ids: ['d1', 'd2'] },
  { endpoint: 'news', label: '新闻', path: '/news-manage', selectAll: '全选当前页新闻', ids: ['n1', 'n2'] },
  { endpoint: 'reviews', label: '评价', path: '/comment-manage', selectAll: '全选当前页评价', ids: ['r1', 'r2'] },
  { endpoint: 'comments', label: '评论', path: '/comment-manage', selectAll: '全选当前已加载评论', ids: ['c1', 'c2'] },
] as const

const records = {
  dishes: [
    { id: 'd1', name: '批量删除测试菜品', canteenName: '第一食堂', windowName: '一号窗口', reviewCount: 2, price: 10 },
    { id: 'd2', name: '香菇青菜配时令蔬菜与杂粮米饭套餐', canteenName: '第一食堂', windowName: '二号窗口', price: 16 },
  ],
  news: [
    { id: 'n1', title: '食堂营业时间调整公告', summary: '周末营业安排', status: 'published', createdAt: '2026-10-01T08:00:00Z' },
    { id: 'n2', title: '关于秋季食堂菜单更新与夜宵供应安排的通知', summary: '新菜单与夜宵供应信息', status: 'published', createdAt: '2026-10-02T08:00:00Z' },
  ],
  reviews: [
    { id: 'r1', dishId: 'd1', userNickname: '同学甲', rating: 4, content: '分量充足，味道很好。', status: 'approved', createdAt: '2026-10-01T08:00:00Z' },
    { id: 'r2', dishId: 'd1', userNickname: '同学乙', rating: 3, content: '希望可以增加一些蔬菜。', status: 'approved', createdAt: '2026-10-01T09:00:00Z' },
  ],
  comments: [
    { id: 'c1', reviewId: 'r1', userNickname: '同学丙', floor: 1, content: '我也推荐这道菜。', status: 'approved', createdAt: '2026-10-01T10:00:00Z' },
    { id: 'c2', reviewId: 'r2', userNickname: '同学丁', floor: 1, content: '期待后续的菜单更新。', status: 'approved', createdAt: '2026-10-01T11:00:00Z' },
  ],
}

for (const resource of resources) {
  test(`${resource.label}: keyboard selection, cancellation, failure and successful batch`, async ({ page }, testInfo) => {
    const deleted = new Set<string>()
    const batches: string[][] = []
    let failNext = true
    const visible = (key: keyof typeof records) => records[key].filter(item => key !== resource.endpoint || !deleted.has(item.id))
    const paginated = (items: unknown[]) => ({ code: 200, data: { items, meta: { page: 1, pageSize: 10, total: items.length, totalPages: 1 } } })

    await page.addInitScript(() => {
      localStorage.clear()
      sessionStorage.clear()
      sessionStorage.setItem('admin_token', 'batch-delete-ui-test')
      sessionStorage.setItem('admin_user', JSON.stringify({ scope: 'GLOBAL', canteenIds: [], canteens: [], id: 'ui-test', username: '界面测试管理员', role: 'admin' }))
      sessionStorage.setItem('admin_permissions', JSON.stringify([
        'dish:view', 'dish:delete', 'news:view', 'news:delete', 'review:delete', 'comment:delete', 'canteen:view',
      ]))
    })

    await page.route('**/*', async route => {
      const request = route.request()
      if (!['fetch', 'xhr'].includes(request.resourceType()) && request.method() === 'GET') {
        return route.continue()
      }
      const path = new URL(request.url()).pathname
      if (request.method() === 'POST' && path.endsWith(`/admin/${resource.endpoint}/batch-delete`)) {
        const { ids } = request.postDataJSON() as { ids: string[] }
        batches.push(ids)
        if (failNext) {
          failNext = false
          return route.fulfill({ status: 400, json: { code: 400, message: '暂时无法删除，请重试' } })
        }
        ids.forEach(id => deleted.add(id))
        return route.fulfill({ json: { code: 200, message: '删除成功', data: { deletedCount: ids.length } } })
      }
      if (request.method() === 'GET' && path.endsWith('/admin/dishes')) {
        return route.fulfill({ json: paginated(visible('dishes')) })
      }
      if (request.method() === 'GET' && path.endsWith('/admin/news')) {
        return route.fulfill({ json: paginated(visible('news')) })
      }
      if (request.method() === 'GET' && path.endsWith('/admin/dishes/d1/reviews')) {
        return route.fulfill({ json: paginated(visible('reviews')) })
      }
      const reviewComments = path.match(/\/admin\/reviews\/(r[12])\/comments$/)
      if (request.method() === 'GET' && reviewComments) {
        return route.fulfill({ json: paginated(visible('comments').filter(item => 'reviewId' in item && item.reviewId === reviewComments[1])) })
      }
      if (request.method() === 'GET' && path.endsWith('/admin/canteens')) {
        return route.fulfill({ json: paginated([]) })
      }
      return route.abort()
    })

    await page.setViewportSize({ width: 1600, height: 1050 })
    await page.goto(resource.path)
    if (resource.path === '/comment-manage') await page.getByText('批量删除测试菜品', { exact: true }).click()
    const rows = page.getByRole('checkbox', { name: new RegExp(`^选择${resource.label} `) })
    await expect(rows).toHaveCount(2)
    await rows.first().focus()
    await page.keyboard.press('Space')
    await expect(rows.first()).toBeChecked()
    const all = page.getByRole('checkbox', { name: resource.selectAll, exact: true })
    await expect(all).toHaveJSProperty('indeterminate', true)
    await all.check()
    await expect(all).toBeChecked()
    const count = page.getByRole('status').filter({ hasText: `已选 2 条${resource.label}` })
    await expect(count).toBeVisible()
    const remove = page.getByRole('button', { name: `批量删除${resource.label}`, exact: true })
    const modal = page.locator('dialog[open]').last()
    await page.screenshot({ path: testInfo.outputPath(`${resource.endpoint}-desktop.png`), fullPage: true })
    await page.setViewportSize({ width: 820, height: 900 })
    await remove.scrollIntoViewIfNeeded()
    await expect(remove).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`${resource.endpoint}-narrow.png`), fullPage: true })

    await remove.click()
    await modal.getByRole('button', { name: '取消', exact: true }).click()
    await expect(count).toBeVisible()
    expect(batches).toEqual([])

    await remove.click()
    await modal.getByRole('button', { name: `删除所选${resource.label}`, exact: true }).click()
    await expect(page.getByText('暂时无法删除，请重试', { exact: true })).toBeVisible()
    await modal.getByRole('button', { name: '确定', exact: true }).click()
    await expect(count).toBeVisible()
    expect(batches).toEqual([resource.ids])

    await remove.click()
    await modal.getByRole('button', { name: `删除所选${resource.label}`, exact: true }).click()
    await expect(page.getByText(`已删除 2 条${resource.label}`, { exact: true })).toBeVisible()
    await modal.getByRole('button', { name: '确定', exact: true }).click()
    await expect(remove).toHaveCount(0)
    await expect(rows).toHaveCount(0)
    expect(batches).toEqual([resource.ids, resource.ids])
  })
}
