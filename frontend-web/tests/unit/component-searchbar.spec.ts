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

  it('shows filter button only when showFilter=true and emits filter', async () => {
    const wrapper = mount(SearchBar, {
      props: {
        showFilter: true,
      },
    })

    const btn = wrapper.find('button')
    expect(btn.exists()).toBe(true)

    await btn.trigger('click')
    expect(wrapper.emitted('filter')).toBeTruthy()

    const wrapper2 = mount(SearchBar, {
      props: {
        showFilter: false,
      },
    })

    expect(wrapper2.find('button').exists()).toBe(false)
  })
})
