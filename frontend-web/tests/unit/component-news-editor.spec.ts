import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

enableAutoUnmount(afterEach)

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

beforeEach(() => vi.resetModules())
afterEach(() => {
  vi.doUnmock('@wangeditor/editor-for-vue')
  vi.doUnmock('@wangeditor/editor/dist/css/style.css')
})

async function fixture() {
  const sdk = deferred<object>()
  const css = deferred<object>()
  const sdkLoad = vi.fn(() => sdk.promise)
  const cssLoad = vi.fn(() => css.promise)
  vi.doMock('@wangeditor/editor-for-vue', sdkLoad)
  vi.doMock('@wangeditor/editor/dist/css/style.css', cssLoad)
  const { default: NewsEditor } = await import('../../src/components/News/NewsEditor.vue')
  const props = { modelValue: '<p>stored draft</p>', config: { placeholder: 'Content' } }
  const instance = { id: 'editor' }
  const Editor = defineComponent({
    props: ['modelValue', 'defaultConfig'],
    emits: ['onCreated', 'update:modelValue'],
    mounted() { this.$emit('onCreated', instance) },
    render() {
      return h('button', { onClick: () => this.$emit('update:modelValue', '<p>edited draft</p>') }, this.modelValue)
    },
  })
  const Toolbar = defineComponent({ render: () => h('div', 'toolbar') })
  return { sdk, css, sdkLoad, cssLoad, NewsEditor, props, instance, modules: { Editor, Toolbar } }
}

describe('NewsEditor resource lifecycle', () => {
  it('waits for both script and stylesheet and forwards the draft and editor events', async () => {
    const f = await fixture()
    const wrapper = mount(f.NewsEditor, { props: f.props })
    expect(wrapper.get('[role="status"]').text()).toContain('正在加载')
    f.sdk.resolve(f.modules)
    await flushPromises()
    expect(wrapper.emitted('created')).toBeUndefined()
    f.css.resolve({})
    await vi.dynamicImportSettled()
    await flushPromises()
    expect(wrapper.emitted('created')).toEqual([[f.instance]])
    expect(wrapper.get('button').text()).toBe(f.props.modelValue)
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['<p>edited draft</p>']])
    wrapper.unmount()
    const reopened = mount(f.NewsEditor, { props: f.props })
    await flushPromises()
    expect(reopened.emitted('created')).toEqual([[f.instance]])
    expect(f.sdkLoad).toHaveBeenCalledTimes(1)
    expect(f.cssLoad).toHaveBeenCalledTimes(1)
  })

  it.each(['script', 'stylesheet'])('keeps a failed %s load blocked when the window is reopened', async kind => {
    const f = await fixture()
    const wrapper = mount(f.NewsEditor, { props: f.props })
    if (kind === 'script') { f.sdk.reject(new Error('offline')); f.css.resolve({}) }
    else { f.sdk.resolve(f.modules); f.css.reject(new Error('offline')) }
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('刷新页面重试')
    expect(wrapper.emitted('created')).toBeUndefined()
    wrapper.unmount()
    const reopened = mount(f.NewsEditor, { props: f.props })
    await flushPromises()
    expect(reopened.get('[role="alert"]').text()).toContain('刷新页面重试')
    expect(reopened.emitted('created')).toBeUndefined()
    expect(f.sdkLoad).toHaveBeenCalledTimes(1)
    expect(f.cssLoad).toHaveBeenCalledTimes(1)
  })

  it('does not create an editor after its window closes while resources are pending', async () => {
    const f = await fixture()
    const wrapper = mount(f.NewsEditor, { props: f.props })
    wrapper.unmount()
    f.sdk.resolve(f.modules)
    f.css.resolve({})
    await vi.dynamicImportSettled()
    await flushPromises()
    expect(wrapper.emitted('created')).toBeUndefined()
    const reopened = mount(f.NewsEditor, { props: f.props })
    await flushPromises()
    expect(reopened.emitted('created')).toEqual([[f.instance]])
  })
})
