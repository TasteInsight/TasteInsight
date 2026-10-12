import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BatchActionBar from '@/components/Common/BatchActionBar.vue'

describe('BatchActionBar', () => {
  it('announces the selected count and emits explicit actions', async () => {
    const wrapper = mount(BatchActionBar, { props: { count: 2, resource: '新闻' } })
    expect(wrapper.get('[role="status"]').text()).toContain('已选 2 条新闻')
    expect(wrapper.text()).toContain('仅当前页')
    await wrapper.get('button:first-child').trigger('click')
    await wrapper.get('button:last-child').trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
    expect(wrapper.emitted('delete')).toHaveLength(1)
    wrapper.unmount()
  })

  it('only exposes batch actions after a selection and clears them with the selection', async () => {
    const wrapper = mount(BatchActionBar, { props: { count: 0, resource: '菜品' } })
    expect(wrapper.find('button').exists()).toBe(false)
    await wrapper.setProps({ count: 1 })
    expect(wrapper.get('button:last-child').text()).toBe('批量删除菜品')
    await wrapper.setProps({ count: 0 })
    expect(wrapper.find('button').exists()).toBe(false)
    wrapper.unmount()
  })

  it.each([{ count: 1, busy: true }, { count: 1, disabled: true }, { count: 101 }])(
    'prevents deletion when unavailable: %j', async props => {
      const wrapper = mount(BatchActionBar, { props: { resource: '评论', ...props } })
      expect(wrapper.get('button:last-child').attributes('disabled')).toBeDefined()
      await wrapper.get('button:last-child').trigger('click')
      expect(wrapper.emitted('delete')).toBeUndefined()
      if (props.count > 100) expect(wrapper.text()).toContain('每次最多删除 100 条')
      wrapper.unmount()
    },
  )
})
