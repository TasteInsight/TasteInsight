import { expect, test } from '@playwright/test'

const targetTypes = [
  { type: 'review', label: '评价', permission: 'review:delete', images: true },
  { type: 'comment', label: '评论', permission: 'comment:delete', images: false },
  { type: 'post', label: '帖子', permission: 'post:delete', images: true },
  { type: 'postComment', label: '帖子评论', permission: 'post:delete', images: false },
] as const

for (const target of targetTypes) {
  test(`${target.label}: filter, detail, image preview and report deletion`, async ({ page }, testInfo) => {
    const calls: unknown[] = []
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const record = {
      id: `report-${target.type}`,
      reporterId: 'reporter',
      targetType: target.type,
      targetId: `content-${target.type}`,
      type: 'spam',
      reason: '内容中出现与食堂评价无关的推广信息。',
      status: 'pending',
      handleResult: null as string | null,
      handledBy: null,
      handledAt: null,
      createdAt: '2026-10-09T10:00:00Z',
      reporter: { id: 'reporter', nickname: '同学甲', avatar: null },
      targetContent: {
        content: '周末午餐体验分享。这条内容附带的推广信息需要管理员核查。',
        userId: 'author',
        userNickname: '同学乙',
        userAvatar: null,
        isDeleted: false,
        images: target.images ? ['https://images.test/report-image.png'] : undefined,
      },
    }

    await page.addInitScript(permission => {
      localStorage.clear()
      sessionStorage.clear()
      sessionStorage.setItem('admin_token', 'report-content-ui-test')
      sessionStorage.setItem('admin_user', JSON.stringify({ scope: 'GLOBAL', canteenIds: [], canteens: [], id: 'admin', username: '举报测试管理员', role: 'admin' }))
      sessionStorage.setItem('admin_permissions', JSON.stringify(['report:handle', permission]))
    }, target.permission)

    await page.route('**/*', async route => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (request.resourceType() === 'image') {
        return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jh2kAAAAASUVORK5CYII=', 'base64') })
      }
      if (request.method() === 'POST' && path.endsWith(`/admin/reports/${record.id}/handle`)) {
        calls.push(request.postDataJSON())
        record.status = 'approved'
        record.handleResult = '内容已删除'
        record.targetContent.isDeleted = true
        return route.fulfill({ json: { code: 200, data: null, message: '处理成功' } })
      }
      if (request.method() === 'GET' && path.endsWith('/admin/reports')) {
        return route.fulfill({ json: { code: 200, data: { items: [record], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } } })
      }
      if (['fetch', 'xhr'].includes(request.resourceType())) return route.abort()
      return route.continue()
    })

    await page.setViewportSize({ width: 1600, height: 1050 })
    await page.goto('/report-manage')
    await expect(page.locator('tbody tr')).toContainText(target.label)
    const requestPromise = page.waitForRequest(request => {
      const url = new URL(request.url())
      return url.pathname.endsWith('/admin/reports') && url.searchParams.get('targetType') === target.type
    })
    await page.getByLabel('举报类型', { exact: true }).selectOption(target.type)
    await requestPromise
    await page.getByRole('button', { name: '详情', exact: true }).click()
    const detail = page.getByRole('dialog', { name: '举报详情', exact: true })
    await expect(detail).toBeVisible()
    await expect(detail.getByRole('button', { name: `删除${target.label}`, exact: true })).toBeEnabled()
    if (target.images) {
      const image = page.getByRole('button', { name: `预览${target.label}图片 1`, exact: true })
      await expect(image).toBeEnabled()
      await image.focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('dialog', { name: '图片预览', exact: true })).toBeVisible()
      await expect(page.getByRole('dialog', { name: '图片预览' }).getByRole('img')).toHaveAttribute('alt', `${target.label}图片 1`)
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog', { name: '图片预览', exact: true })).toBeHidden()
      await expect(detail).toBeVisible()
    }
    await page.screenshot({ path: testInfo.outputPath(`${target.type}-desktop.png`), fullPage: true })
    await page.setViewportSize({ width: 820, height: 900 })
    const title = detail.getByRole('heading', { name: '举报详情', exact: true })
    await expect(title).toBeVisible()
    const titleBounds = await title.boundingBox()
    expect(titleBounds).not.toBeNull()
    expect(await title.evaluate(element => {
      const bounds = element.getBoundingClientRect()
      return element.contains(document.elementFromPoint(bounds.left + 10, bounds.top + bounds.height / 2))
    })).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`${target.type}-narrow.png`), fullPage: true })
    await detail.getByRole('button', { name: `删除${target.label}`, exact: true }).click()
    const confirm = page.locator('dialog[open]').filter({ has: page.getByRole('button', { name: '确定', exact: true }) })
    await confirm.getByRole('button', { name: '取消', exact: true }).click()
    expect(calls).toEqual([])
    await detail.getByRole('button', { name: `删除${target.label}`, exact: true }).click()
    await confirm.getByRole('button', { name: '确定', exact: true }).click()
    await expect(page.getByText('删除成功', { exact: true })).toBeVisible()
    await confirm.getByRole('button', { name: '确定', exact: true }).click()
    await expect(detail.getByText('内容已被删除', { exact: true })).toBeVisible()
    await expect(detail.getByRole('button', { name: `删除${target.label}`, exact: true })).toHaveCount(0)
    expect(calls).toEqual([{ action: 'delete_content' }])
    expect(errors).toEqual([])
  })
}
