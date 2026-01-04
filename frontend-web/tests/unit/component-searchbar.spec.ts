import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchBar from '../../src/components/Common/SearchBar.vue'

describe('components/Common/SearchBar', () => {
  it('emits update:modelValue on input', async () => {
    const wrapper = mount(SearchBar, {
      props: {
        modelValue: '',
        placeholder: 'Search here',
      },
    })

    const input = wrapper.find('input[type="text"]')
    await input.setValue('abc')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['abc'])
  })

  it('shows clear button when modelValue is not empty and emits empty string on click', async () => {
    const wrapper = mount(SearchBar, {
      props: {
        modelValue: 'test',
      },
    })

    // Clear button should exist when there's content
    const btn = wrapper.find('button[title="清除搜索"]')
    expect(btn.exists()).toBe(true)

    await btn.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([''])

    // Clear button should not exist when modelValue is empty
    const wrapper2 = mount(SearchBar, {
      props: {
        modelValue: '',
      },
    })

    expect(wrapper2.find('button[title="清除搜索"]').exists()).toBe(false)
  })

  it('renders with custom placeholder', async () => {
    const wrapper = mount(SearchBar, {
      props: {
        modelValue: '',
        placeholder: '自定义搜索提示',
      },
    })

    const input = wrapper.find('input[type="text"]')
    expect(input.attributes('placeholder')).toBe('自定义搜索提示')
  })
})
