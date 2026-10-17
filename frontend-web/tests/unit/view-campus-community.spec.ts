import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useAuthStore } from '@/store/modules/use-auth-store'
import StudentVerificationManage from '@/views/StudentVerificationManage.vue'
import CommunityManage from '@/views/CommunityManage.vue'
import type { Admin } from '@/types/api'

const mocks = vi.hoisted(() => ({
  students: { list: vi.fn(), decide: vi.fn() },
  community: { list: vi.fn(), approve: vi.fn(), reject: vi.fn(), delete: vi.fn() },
  confirm: vi.fn(),
  danger: vi.fn(),
}))
vi.mock('@/api/modules/student-verification', () => ({ studentVerificationApi: mocks.students }))
vi.mock('@/api/modules/community', () => ({ communityApi: mocks.community }))
vi.mock('@/composables/useModal', () => ({
  showConfirm: mocks.confirm,
  showConfirmDanger: mocks.danger,
}))

const updatedAt = '2026-10-09T00:00:00.000Z'
const student = {
  id: 's1',
  userId: 'u1',
  schoolCode: 'tsinghua',
  status: 'PENDING',
  method: 'MANUAL_REVIEW',
  email: 'student@example.edu',
  emailVerifiedAt: updatedAt,
  updatedAt,
  user: {scope: 'GLOBAL' as 'GLOBAL' | 'CANTEENS', canteenIds: [], canteens: [],  nickname: '同学甲' },
  reason: null,
  expiresAt: null,
  verifiedAt: null,
  reviewedAt: null,
}
const post = {
  id: 'p1',
  userId: 'u1',
  userNickname: '同学甲',
  content: '完整原文 <script>不能执行</script>',
  images: ['https://example.test/image.png'],
  status: 'pending',
  createdAt: updatedAt,
  updatedAt,
  rejectReason: null,
}
const listResponse = (items: unknown[], total = items.length, page = 1) => ({
  code: 200,
  data: { items, meta: { page, pageSize: 20, total, totalPages: Math.ceil(total / 20) } },
})
const byText = (wrapper: VueWrapper, text: string) => {
  const button = wrapper.findAll('button').find((item) => item.text() === text)
  if (!button) throw new Error(`未找到按钮：${text}`)
  return button
}

let wrapper: VueWrapper | undefined
let auth: ReturnType<typeof useAuthStore>
beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  auth = useAuthStore()
  auth.user = { id: 'admin1', username: '管理员', role: 'staff', scope: 'GLOBAL', canteenIds: [], canteens: [], createdAt: '2026-10-17T00:00:00Z' } as Admin
  auth.permissions = ['student:review', 'post:view', 'post:approve', 'post:delete']
  mocks.students.list.mockResolvedValue(listResponse([student]))
  mocks.students.decide.mockResolvedValue({ code: 200 })
  mocks.community.list.mockResolvedValue(listResponse([post]))
  for (const action of ['approve', 'reject', 'delete'] as const)
    mocks.community[action].mockResolvedValue({ code: 200 })
  mocks.confirm.mockResolvedValue(true)
  mocks.danger.mockResolvedValue(true)
})
afterEach(() => wrapper?.unmount())

describe('student verification management', () => {
  async function selectStudent() {
    wrapper = mount(StudentVerificationManage)
    await flushPromises()
    await byText(wrapper, student.status === 'PENDING' ? '核验申请' : '查看详情').trigger('click')
  }

  it('loads pending once, displays evidence and bounds concurrent refreshes', async () => {
    let resolve!: (value: unknown) => void
    mocks.students.list.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      }),
    )
    wrapper = mount(StudentVerificationManage)
    expect(wrapper.text()).toContain('正在读取认证申请')
    expect(wrapper.get('select[aria-label="认证状态"]').attributes('disabled')).toBeDefined()
    await byText(wrapper, '刷新列表').trigger('click')
    expect(mocks.students.list).toHaveBeenCalledTimes(1)
    resolve(listResponse([student]))
    await flushPromises()
    expect(mocks.students.list).toHaveBeenCalledWith(
      { page: 1, pageSize: 20, status: 'PENDING' },
      expect.any(AbortSignal),
    )
    await byText(wrapper, '核验申请').trigger('click')
    expect(wrapper.text()).toContain('校园邮箱 · 人工核验')
    expect(wrapper.text()).toContain(student.email)
  })

  it.each(['scope', 'permission'])(
    'does not request student records without global review access (%s)',
    async (mode) => {
      if (mode === 'scope') auth.user!.scope = 'CANTEENS'
      else auth.permissions = []
      wrapper = mount(StudentVerificationManage)
      await flushPromises()
      expect(mocks.students.list).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain('仅限拥有审核权限的全局管理员')
    },
  )

  it('requires evidence and a bounded future expiry before sending an approval snapshot', async () => {
    await selectStudent()
    await wrapper!.get('form').trigger('submit')
    expect(wrapper!.text()).toContain('请填写审核依据')
    await wrapper!.get('textarea').setValue('  核验在校证明  ')
    for (const date of ['2020-01-01T00:00', '2099-01-01T00:00']) {
      await wrapper!.get('input[type="datetime-local"]').setValue(date)
      await wrapper!.get('form').trigger('submit')
      expect(mocks.students.decide).not.toHaveBeenCalled()
      expect(wrapper!.text()).toContain('请选择不超过 366 天的未来有效期')
    }
    const date = new Date(Date.now() + 30 * 86400000)
    const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T12:00`
    await wrapper!.get('input[type="datetime-local"]').setValue(localDate)
    await wrapper!.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.students.decide).toHaveBeenCalledWith('u1', {
      decision: 'APPROVE',
      reason: '核验在校证明',
      expectedUpdatedAt: updatedAt,
      expiresAt: new Date(localDate).toISOString(),
    })
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
  })

  it('rejects with danger confirmation and no expiry', async () => {
    await selectStudent()
    await wrapper!.get('select[aria-label="处理结果"]').setValue('REJECT')
    await wrapper!.get('textarea').setValue('无法确认在校身份')
    await wrapper!.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.danger).toHaveBeenCalledTimes(1)
    expect(mocks.students.decide).toHaveBeenCalledWith('u1', {
      decision: 'REJECT',
      reason: '无法确认在校身份',
      expectedUpdatedAt: updatedAt,
    })
  })

  it('allows revocation from verified records and cancellation never writes', async () => {
    mocks.students.list.mockResolvedValue(
      listResponse([{ ...student, status: 'VERIFIED', expiresAt: '2027-01-01T00:00:00.000Z' }]),
    )
    wrapper = mount(StudentVerificationManage)
    await flushPromises()
    await wrapper.get('select[aria-label="认证状态"]').setValue('VERIFIED')
    await flushPromises()
    await byText(wrapper, '查看详情').trigger('click')
    expect(wrapper.find('input[type="datetime-local"]').exists()).toBe(false)
    await wrapper.get('textarea').setValue('认证材料撤销')
    mocks.danger.mockResolvedValueOnce(false)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.students.decide).not.toHaveBeenCalled()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.students.decide).toHaveBeenCalledWith('u1', {
      decision: 'REVOKE',
      reason: '认证材料撤销',
      expectedUpdatedAt: updatedAt,
    })
  })

  it('blocks stale resubmission until the application is reread', async () => {
    mocks.students.decide.mockRejectedValueOnce(new Error('申请已更新，请刷新后审核'))
    await selectStudent()
    await wrapper!.get('select[aria-label="处理结果"]').setValue('REJECT')
    await wrapper!.get('textarea').setValue('待补材料')
    await wrapper!.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper!.text()).toContain('申请已更新')
    await wrapper!.get('form').trigger('submit')
    expect(mocks.students.decide).toHaveBeenCalledTimes(1)
    await byText(wrapper!, '重新读取申请').trigger('click')
    await flushPromises()
    expect(mocks.students.list).toHaveBeenCalledTimes(2)
    expect(wrapper!.find('form').exists()).toBe(false)
  })

  it('distinguishes load failure from empty results and supports retry', async () => {
    mocks.students.list
      .mockRejectedValueOnce(new Error('网络中断'))
      .mockResolvedValueOnce(listResponse([]))
    wrapper = mount(StudentVerificationManage)
    await flushPromises()
    expect(wrapper.text()).toContain('网络中断')
    expect(wrapper.text()).not.toContain('暂无待审核')
    await byText(wrapper, '重试').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('暂无待审核')
  })

  it('clears private student data and aborts reads after access is revoked', async () => {
    wrapper = mount(StudentVerificationManage)
    await flushPromises()
    const signal = mocks.students.list.mock.calls[0][1] as AbortSignal
    auth.user!.scope = 'CANTEENS'
    await nextTick()
    expect(signal.aborted).toBe(true)
    expect(wrapper.text()).not.toContain(student.email)
  })
})

describe('community management', () => {
  async function selectPost() {
    wrapper = mount(CommunityManage)
    await flushPromises()
    await byText(wrapper, '查看原文').trigger('click')
  }

  it('loads one active resource and filters all three statuses or all states', async () => {
    wrapper = mount(CommunityManage)
    await flushPromises()
    expect(mocks.community.list).toHaveBeenCalledTimes(1)
    expect(mocks.community.list).toHaveBeenLastCalledWith(
      'posts',
      { page: 1, pageSize: 20, status: 'pending' },
      expect.any(AbortSignal),
    )
    await wrapper.get('select[aria-label="内容类型"]').setValue('post-comments')
    await flushPromises()
    expect(mocks.community.list).toHaveBeenLastCalledWith(
      'post-comments',
      { page: 1, pageSize: 20, status: 'pending' },
      expect.any(AbortSignal),
    )
    await wrapper.get('select[aria-label="审核状态"]').setValue('approved')
    await flushPromises()
    expect(mocks.community.list).toHaveBeenLastCalledWith(
      'post-comments',
      { page: 1, pageSize: 20, status: 'approved' },
      expect.any(AbortSignal),
    )
    await wrapper.get('select[aria-label="审核状态"]').setValue('')
    await flushPromises()
    expect(mocks.community.list).toHaveBeenLastCalledWith(
      'post-comments',
      { page: 1, pageSize: 20 },
      expect.any(AbortSignal),
    )
  })

  it('shows escaped original text and image links, then approves exactly the displayed revision', async () => {
    await selectPost()
    expect(wrapper!.get('.moderation-content').text()).toBe(post.content)
    expect(wrapper!.find('script').exists()).toBe(false)
    expect(wrapper!.get('.moderation-images a').attributes('href')).toBe(post.images[0])
    await byText(wrapper!, '通过审核').trigger('click')
    await flushPromises()
    expect(mocks.community.approve).toHaveBeenCalledWith('posts', 'p1', {
      expectedUpdatedAt: updatedAt,
    })
  })

  it('requires a rejection reason and preserves the snapshot for post replies', async () => {
    mocks.community.list.mockResolvedValue(
      listResponse([{ ...post, id: 'c1', postId: 'p1', parentCommentId: 'c0', images: undefined }]),
    )
    wrapper = mount(CommunityManage)
    await flushPromises()
    await wrapper.get('select[aria-label="内容类型"]').setValue('post-comments')
    await flushPromises()
    await byText(wrapper, '查看原文').trigger('click')
    expect(wrapper.text()).toContain('被回复的回复 ID')
    await byText(wrapper, '拒绝内容').trigger('click')
    expect(mocks.community.reject).not.toHaveBeenCalled()
    await wrapper.get('textarea').setValue('  广告  ')
    await byText(wrapper, '拒绝内容').trigger('click')
    await flushPromises()
    expect(mocks.community.reject).toHaveBeenCalledWith('post-comments', 'c1', {
      expectedUpdatedAt: updatedAt,
      reason: '广告',
    })
    expect(mocks.danger).toHaveBeenCalledTimes(1)
  })

  it('shows only deletion for approved content and asks for dangerous confirmation', async () => {
    mocks.community.list.mockResolvedValue(listResponse([{ ...post, status: 'approved' }]))
    await selectPost()
    expect(wrapper!.text()).not.toContain('通过审核拒绝内容')
    expect(wrapper!.find('textarea').exists()).toBe(false)
    await byText(wrapper!, '删除帖子').trigger('click')
    await flushPromises()
    expect(mocks.danger).toHaveBeenCalledWith(
      expect.stringContaining('回复也将不可见'),
      '删除帖子',
      '删除帖子',
    )
    expect(mocks.community.delete).toHaveBeenCalledWith('posts', 'p1')
  })

  it('never exposes mutations to a view-only account', async () => {
    auth.permissions = ['post:view']
    await selectPost()
    expect(wrapper!.findAll('button').map((button) => button.text())).not.toContain('通过审核')
    expect(wrapper!.findAll('button').map((button) => button.text())).not.toContain('删除帖子')
  })

  it('does not fetch community content for a scoped admin even with permission strings', async () => {
    auth.user!.scope = 'CANTEENS'
    wrapper = mount(CommunityManage)
    await flushPromises()
    expect(mocks.community.list).not.toHaveBeenCalled()
  })

  it('prevents duplicate actions during confirmation and rejects obsolete revisions', async () => {
    let confirm!: (value: boolean) => void
    mocks.confirm.mockReturnValueOnce(
      new Promise((resolve) => {
        confirm = resolve
      }),
    )
    mocks.community.approve.mockRejectedValueOnce(new Error('内容或审核状态已变更，请刷新'))
    await selectPost()
    await byText(wrapper!, '通过审核').trigger('click')
    await byText(wrapper!, '通过审核').trigger('click')
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    confirm(true)
    await flushPromises()
    expect(mocks.community.approve).toHaveBeenCalledTimes(1)
    expect(wrapper!.text()).toContain('内容或审核状态已变更')
    expect(wrapper!.findAll('button').map((button) => button.text())).not.toContain('通过审核')
  })

  it('backs up a disappeared last page with one corrective request', async () => {
    mocks.community.list
      .mockResolvedValueOnce(listResponse([post], 21))
      .mockResolvedValueOnce(listResponse([], 20, 2))
      .mockResolvedValueOnce(listResponse([post], 20))
    wrapper = mount(CommunityManage)
    await flushPromises()
    await byText(wrapper, '2').trigger('click')
    await flushPromises()
    expect(mocks.community.list).toHaveBeenCalledTimes(3)
    expect(mocks.community.list).toHaveBeenLastCalledWith(
      'posts',
      { page: 1, pageSize: 20, status: 'pending' },
      expect.any(AbortSignal),
    )
  })

  it('aborts in-flight requests on leaving the page', async () => {
    mocks.community.list.mockReturnValueOnce(new Promise(() => {}))
    wrapper = mount(CommunityManage)
    const signal = mocks.community.list.mock.calls[0][2] as AbortSignal
    wrapper.unmount()
    wrapper = undefined
    expect(signal.aborted).toBe(true)
  })
})
