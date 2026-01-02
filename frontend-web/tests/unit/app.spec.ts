import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '@/App.vue'

describe('App.vue', () => {
  it('renders router-view container', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          'router-view': { template: '<div data-test="rv" />' },
        },
      },
    })

    expect(wrapper.find('#app').exists()).toBe(true)
    expect(wrapper.find('[data-test="rv"]').exists()).toBe(true)
  })
})
