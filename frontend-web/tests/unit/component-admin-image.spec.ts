import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import AdminImage from '../../src/components/Common/AdminImage.vue'
import DishForm from '../../src/components/Dishes/DishForm.vue'
import DishTable from '../../src/components/Dishes/DishTable.vue'

enableAutoUnmount(afterEach)

describe('admin media states', () => {
  it.each([undefined, null, '', '   '])('omits the thumbnail box for an empty source (%s)', (src) => {
    const wrapper = mount(AdminImage, { props: { src, alt: '菜品' } })

    expect(wrapper.findAll('*')).toHaveLength(0)
  })

  it('removes a failed table thumbnail while retaining the dish identity', async () => {
    const wrapper = mount(DishTable, {
      props: {
        columns: [{ key: 'image', title: '菜品', type: 'image' }],
        data: [{ id: 'dish-1', name: '清炒时蔬', image: '/missing-dish.jpg' }],
      },
    })

    await wrapper.get('img').trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('清炒时蔬')
    expect(wrapper.text()).toContain('#dish-1')
  })

  it('uses a compact initial for both absent and failed avatars', async () => {
    const wrapper = mount(AdminImage, {
      props: { alt: '张同学', variant: 'avatar', imageClass: 'w-8 h-8 rounded-full' },
    })

    expect(wrapper.get('[role="img"]').text()).toBe('张')
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toBe('张同学的头像不可用')
    expect(wrapper.get('[role="img"]').classes()).toContain('w-8')

    await wrapper.setProps({ src: '/avatar.jpg' })
    expect(wrapper.find('[role="img"]').exists()).toBe(false)
    await wrapper.get('img').trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('[role="img"]').text()).toBe('张')
  })

  it('shows a compact missing preview without a retry or preview action', () => {
    const wrapper = mount(AdminImage, {
      props: { alt: '菜品图片', variant: 'preview', previewable: true },
    })

    expect(wrapper.text()).toBe('暂无图片')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.get('[data-state="unavailable"]').classes()).not.toContain('aspect-square')
  })

  it('collapses a failed preview, retries the same URL and opens only a loaded image', async () => {
    const wrapper = mount(AdminImage, {
      props: {
        src: '/dish.jpg',
        alt: '菜品图片',
        variant: 'preview',
        previewable: true,
        imageClass: 'w-full h-48 aspect-square object-cover',
      },
    })
    const originalImage = wrapper.get('img').element

    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('preview')).toBeUndefined()
    await wrapper.get('img').trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('图片加载失败')
    expect(wrapper.find('[class*="aspect-square"]').exists()).toBe(false)
    expect(wrapper.find('[class*="h-48"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="预览菜品图片"]').exists()).toBe(false)

    await wrapper.get('button').trigger('click')
    expect(wrapper.get('img').attributes('src')).toBe('/dish.jpg')
    expect(wrapper.get('img').element).not.toBe(originalImage)
    expect(wrapper.emitted('preview')).toBeUndefined()
    await wrapper.get('img').trigger('load')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('preview')).toEqual([['/dish.jpg']])
  })

  it('resets failure and loaded state when the source changes without reusing the old image', async () => {
    const wrapper = mount(AdminImage, {
      props: { src: '/first.jpg', alt: '菜品图片', variant: 'preview', previewable: true },
    })
    const firstImage = wrapper.get('img')
    await firstImage.trigger('error')
    await wrapper.setProps({ src: '/second.jpg' })

    expect(wrapper.get('img').attributes('src')).toBe('/second.jpg')
    expect(wrapper.get('img').element).not.toBe(firstImage.element)
    await firstImage.trigger('load')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    await wrapper.get('img').trigger('load')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('preview')).toEqual([['/second.jpg']])

    await wrapper.setProps({ src: '/third.jpg' })
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ src: '' })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toBe('暂无图片')
  })

  it('keeps native new-tab links for available community media and removes them after failure', async () => {
    const wrapper = mount(AdminImage, {
      props: { src: '/post.jpg', alt: '帖子图片', variant: 'preview', previewable: 'link', loading: 'lazy' },
    })
    const link = wrapper.get('a')

    expect(link.attributes('href')).toBe('/post.jpg')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('aria-label')).toBe('在新窗口查看帖子图片')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
    expect(wrapper.get('img').attributes('loading')).toBe('lazy')
    const earlyClick = new MouseEvent('click', { bubbles: true, cancelable: true })
    expect(link.element.dispatchEvent(earlyClick)).toBe(false)

    await wrapper.get('img').trigger('load')
    expect(wrapper.get('a').attributes('aria-disabled')).toBeUndefined()
    await wrapper.get('img').trigger('error')
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.text()).toContain('图片加载失败')
  })

  it('does not propagate a retry into an enclosing media action', async () => {
    const clicked = vi.fn()
    const wrapper = mount(defineComponent({
      components: { AdminImage },
      setup: () => ({ clicked }),
      template: '<div @click="clicked"><AdminImage src="/dish.jpg" alt="菜品" variant="preview" /></div>',
    }))

    await wrapper.get('img').trigger('error')
    await wrapper.get('button').trigger('click')

    expect(clicked).not.toHaveBeenCalled()
  })

  it('keeps the image replacement control usable after an upload preview fails', async () => {
    const wrapper = mount(DishForm, { props: { dish: { image: '/unavailable-preview.jpg' } } })
    const fileInput = wrapper.get('input[type="file"]').element as HTMLInputElement
    const chooseFile = vi.spyOn(fileInput, 'click').mockImplementation(() => undefined)

    await wrapper.get('img').trigger('error')
    expect(wrapper.text()).toContain('图片加载失败')
    await wrapper.findAll('button').find((button) => button.text() === '更换图片')!.trigger('click')

    expect(chooseFile).toHaveBeenCalledOnce()
  })
})
