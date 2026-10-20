import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Pagination from '../../src/components/Common/Pagination.vue'

describe('components/Common/Pagination', () => {
  it('renders range text correctly', () => {
    const wrapper = mount(Pagination, {
      props: {
        currentPage: 2,
        pageSize: 10,
        total: 35,
      },
    })

    expect(wrapper.text()).toContain('显示 11-20 条，共 35 条记录')
  })

  it('renders an empty range and prevents navigation without records', async () => {
    const wrapper = mount(Pagination, { props: { currentPage: 1, total: 0 } })

    expect(wrapper.text()).toContain('显示 0-0 条，共 0 条记录')
    expect(wrapper.findAll('[aria-current="page"]')).toHaveLength(0)
    expect(wrapper.find('input').attributes('disabled')).toBeDefined()
    for (const button of wrapper.findAll('button')) {
      expect(button.attributes('disabled')).toBeDefined()
      await button.trigger('click')
    }
    await wrapper.find('input').trigger('keyup.enter')
    expect(wrapper.emitted('page-change')).toBeUndefined()
  })

  it('caps endIndex at total when last page is partial', () => {
    const wrapper = mount(Pagination, {
      props: {
        currentPage: 2,
        pageSize: 10,
        total: 15,
      },
    })

    expect(wrapper.text()).toContain('显示 11-15 条，共 15 条记录')
  })

  it('emits page-change on page click', async () => {
    const wrapper = mount(Pagination, {
      props: { currentPage: 2, pageSize: 10, total: 50 },
    })

    // Click page 3 button
    const page3 = wrapper
      .findAll('button')
      .find((b) => b.text().trim() === '3')

    expect(page3, 'page 3 button exists').toBeTruthy()
    await page3!.trigger('click')

    expect(wrapper.emitted('page-change')?.[0]).toEqual([3])
  })

  it('emits page-change when clicking prev/next', async () => {
    const wrapper = mount(Pagination, {
      props: { currentPage: 2, pageSize: 10, total: 50 },
    })

    const buttons = wrapper.findAll('button')
    const prev = buttons[0]
    const next = buttons[buttons.length - 2]

    await prev.trigger('click')
    expect(wrapper.emitted('page-change')?.[wrapper.emitted('page-change')!.length - 1]).toEqual([1])

    await next.trigger('click')
    expect(wrapper.emitted('page-change')?.[wrapper.emitted('page-change')!.length - 1]).toEqual([3])
  })

  it('disables prev on first page and next on last page', () => {
    const first = mount(Pagination, {
      props: { currentPage: 1, pageSize: 10, total: 50 },
    })
    const firstButtons = first.findAll('button')
    expect(firstButtons[0].attributes('disabled')).toBeDefined() // 上一页

    const last = mount(Pagination, {
      props: { currentPage: 5, pageSize: 10, total: 50 },
    })
    const lastButtons = last.findAll('button')
    expect(lastButtons[lastButtons.length - 2].attributes('disabled')).toBeDefined() // 下一页
  })

  it('applies active class to current page button', () => {
    const wrapper = mount(Pagination, {
      props: { currentPage: 2, pageSize: 10, total: 50 },
    })

    const page2 = wrapper
      .findAll('button')
      .find((b) => b.text().trim() === '2')

    expect(page2, 'page 2 button exists').toBeTruthy()
    expect(page2!.classes()).toContain('admin-button-primary')
  })

  it('jump sanitizes invalid input and clamps to totalPages', async () => {
    const wrapper = mount(Pagination, {
      props: { currentPage: 1, pageSize: 10, total: 50 },
    })

    const input = wrapper.find('input[type="number"]')

    await input.setValue('0')
    await wrapper.findAll('button')[wrapper.findAll('button').length - 1]!.trigger('click') // 确定
    expect(wrapper.emitted('page-change')?.[wrapper.emitted('page-change')!.length - 1]).toEqual([1])

    await input.setValue('999')
    await wrapper.findAll('button')[wrapper.findAll('button').length - 1]!.trigger('click')
    expect(wrapper.emitted('page-change')?.[wrapper.emitted('page-change')!.length - 1]).toEqual([5])
  })

  it('normalizes fractional jump values to an integer page', async () => {
    const wrapper = mount(Pagination, {
      props: { currentPage: 1, pageSize: 10, total: 50 },
    })

    const input = wrapper.find('input[type="number"]')
    await input.setValue('3.5')
    await input.trigger('keyup.enter')

    expect(wrapper.emitted('page-change')).toEqual([[3]])
    expect((input.element as HTMLInputElement).value).toBe('3')
  })

  it('jump triggers on Enter key', async () => {
    const wrapper = mount(Pagination, {
      props: { currentPage: 1, pageSize: 10, total: 50 },
    })

    const input = wrapper.find('input[type="number"]')
    await input.setValue('3')
    await input.trigger('keyup.enter')

    expect(wrapper.emitted('page-change')?.[wrapper.emitted('page-change')!.length - 1]).toEqual([3])
  })

  it('jump treats NaN input as page 1', async () => {
    const wrapper = mount(Pagination, {
      props: { currentPage: 1, pageSize: 10, total: 50 },
    })

    ;(wrapper.vm as any).inputPage = Number.NaN
    await wrapper.findAll('button')[wrapper.findAll('button').length - 1]!.trigger('click')

    expect(wrapper.emitted('page-change')?.[wrapper.emitted('page-change')!.length - 1]).toEqual([1])
  })

  it('supports compact contexts and accessible pagination names', () => {
    const wrapper = mount(Pagination, { props: { total: 50, showJump: false, label: '菜品分页' } })
    expect(wrapper.get('nav').attributes('aria-label')).toBe('菜品分页')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.text()).toContain('下一页')
  })

  it('disables every navigation control while the owning task is busy', async () => {
    const wrapper = mount(Pagination, { props: { total: 50, disabled: true } })
    for (const button of wrapper.findAll('button')) {
      expect(button.attributes('disabled')).toBeDefined()
      await button.trigger('click')
    }
    await wrapper.get('input').trigger('keyup.enter')
    expect(wrapper.emitted('page-change')).toBeUndefined()
  })

  it('syncs inputPage when currentPage prop changes', async () => {
    const wrapper = mount(Pagination, {
      props: { currentPage: 1, pageSize: 10, total: 50 },
    })

    await wrapper.setProps({ currentPage: 3 })

    const input = wrapper.find('input[type="number"]').element as HTMLInputElement
    expect(input.value).toBe('3')
  })
})
