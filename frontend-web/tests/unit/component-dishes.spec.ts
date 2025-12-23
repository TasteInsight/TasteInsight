import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import BatchUpload from '@/components/Dishes/BatchUpload.vue'
import DishForm from '@/components/Dishes/DishForm.vue'
import DishTable from '@/components/Dishes/DishTable.vue'

function createFile(name: string, size: number, type = 'application/vnd.ms-excel') {
  const blob = new Blob([new ArrayBuffer(size)], { type })
  return new File([blob], name, { type })
}

describe('components/Dishes', () => {
  it('DishTable paginates and emits actions', async () => {
    const wrapper = mount(DishTable, {
      props: {
        columns: [
          { key: 'name', title: 'Name' },
          { key: 'status', title: 'Status', type: 'status' },
          { key: 'actions', title: 'Actions', type: 'actions', class: 'text-center' },
        ],
        data: [
          { id: 1, name: 'A', status: '有效' },
          { id: 2, name: 'B', status: '无效' },
        ],
        actions: ['edit', 'delete', 'view'],
        currentPage: 1,
        pageSize: 1,
      },
    })

    expect(wrapper.text()).toContain('A')
    expect(wrapper.text()).not.toContain('B')

    await wrapper.find('button[title="编辑"]').trigger('click')
    await wrapper.find('button[title="删除"]').trigger('click')
    await wrapper.find('button[title="查看"]').trigger('click')

    expect(wrapper.emitted('edit')?.[0]?.[0]).toMatchObject({ id: 1 })
    expect(wrapper.emitted('delete')?.[0]?.[0]).toMatchObject({ id: 1 })
    expect(wrapper.emitted('view')?.[0]?.[0]).toMatchObject({ id: 1 })
  })

  it('DishTable covers image/status/rating/price branches and empty state', async () => {
    const wrapper = mount(DishTable, {
      props: {
        columns: [
          { key: 'img', title: 'Img', type: 'image' },
          { key: 'status', title: 'Status', type: 'status' },
          { key: 'rating', title: 'Rating', type: 'rating' },
          { key: 'price', title: 'Price', type: 'price' },
          { key: 'name', title: 'Name' },
        ],
        data: [
          { id: 1, name: 'A', img: '', status: true, rating: 4.5, price: '¥10' },
          { id: 2, name: 'B', img: 'http://x', status: '待审核', rating: 3, price: '¥20' },
          { id: 3, name: 'C', img: null, status: null, rating: 5, price: '¥30' },
          { id: 4, name: 'D', img: '', status: '禁用', rating: 2, price: '¥40' },
        ],
        imageFallback: 'fallback.png',
        currentPage: 1,
        pageSize: 10,
      },
    })

    // image fallback + id label
    const img = wrapper.find('img')
    expect(img.attributes('src')).toBe('fallback.png')
    expect(wrapper.text()).toContain('#1')

    // status text/class branches
    expect(wrapper.text()).toContain('启用')
    expect(wrapper.text()).toContain('待审核')
    expect(wrapper.text()).toContain('禁用')

    // empty status text branch
    expect(wrapper.findAll('span').some((s) => s.text() === '')).toBe(true)

    // non-finite pagination branch
    await wrapper.setProps({ currentPage: Number.NaN, pageSize: Number.NaN })
    expect(wrapper.text()).toContain('A')

    // empty state
    await wrapper.setProps({ data: [] })
    expect(wrapper.text()).toContain('暂无数据')
  })

  it('BatchUpload validates file extension and size', async () => {
    vi.useFakeTimers()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined)

    const wrapper = mount(BatchUpload, {
      props: { loading: false },
    })

    // invalid ext
    await wrapper.vm.handleFileSelect({ target: { files: [createFile('a.png', 10)] } })
    expect(wrapper.vm.uploadError).toContain('.xlsx')

    // too large
    await wrapper.vm.handleFileSelect({ target: { files: [createFile('a.xlsx', 10 * 1024 * 1024 + 1)] } })
    expect(wrapper.vm.uploadError).toContain('10MB')

    // valid
    await wrapper.vm.handleFileSelect({ target: { files: [createFile('a.xlsx', 1024)] } })
    expect(wrapper.vm.uploadedFile?.name).toBe('a.xlsx')

    // download template
    wrapper.vm.downloadTemplate()
    expect(alertSpy).toHaveBeenCalled()

    vi.runAllTimers()
    vi.useRealTimers()
  })

  it('BatchUpload triggerFileInput clicks underlying input', async () => {
    const wrapper = mount(BatchUpload)
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => undefined)

    wrapper.vm.triggerFileInput()
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('BatchUpload handleFileDrop updates dragging state and calls validation', async () => {
    const wrapper = mount(BatchUpload)
    // @ts-expect-error simplify for test
    wrapper.vm.isDragging = true

    const file = createFile('a.xlsx', 1024)
    await wrapper.vm.handleFileDrop({
      dataTransfer: {
        files: [file],
      },
    })

    expect(wrapper.vm.isDragging).toBe(false)
    expect(wrapper.vm.uploadedFile?.name).toBe('a.xlsx')
  })

  it('BatchUpload submit shows alert when no valid items', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    const wrapper = mount(BatchUpload)

    wrapper.vm.parsedData = [{ id: 1, status: '错误' }]
    wrapper.vm.submitBatchData()
    expect(alertSpy).toHaveBeenCalledWith('没有有效数据可导入')
  })

  it('BatchUpload submit/reset emits', async () => {
    const wrapper = mount(BatchUpload)

    wrapper.vm.submitBatchData()
    expect(wrapper.emitted('submit')).toBeTruthy()

    wrapper.vm.resetBatchData()
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('DishForm validates and emits submit with floor removed', async () => {
    const wrapper = mount(DishForm)

    // invalid => no submit
    wrapper.vm.handleSubmit()
    await nextTick()
    expect(wrapper.emitted('submit')).toBeFalsy()
    expect(wrapper.vm.errors.canteen).toBeTruthy()

    // fill minimal valid form
    wrapper.vm.formData.canteen = '紫荆园'
    wrapper.vm.formData.floor = '一层'
    wrapper.vm.formData.window = '窗口'
    wrapper.vm.formData.name = '菜品'
    wrapper.vm.formData.subItems[0].name = '子项'
    wrapper.vm.formData.subItems[0].price = '10'

    wrapper.vm.handleSubmit()
    await nextTick()

    const payload = wrapper.emitted('submit')?.[0]?.[0]
    expect(payload).toBeTruthy()
    expect(Object.prototype.hasOwnProperty.call(payload, 'floor')).toBe(false)
  })

  it('DishForm subItems add/remove respects minimum 1', async () => {
    const wrapper = mount(DishForm)

    expect(wrapper.vm.formData.subItems.length).toBe(1)
    wrapper.vm.removeSubItem(0)
    await nextTick()
    expect(wrapper.vm.formData.subItems.length).toBe(1)

    wrapper.vm.addSubItem()
    await nextTick()
    expect(wrapper.vm.formData.subItems.length).toBe(2)

    wrapper.vm.removeSubItem(0)
    await nextTick()
    expect(wrapper.vm.formData.subItems.length).toBe(1)
  })

  it('DishForm handles file select/drop branches', async () => {
    class FR {
      onload: ((e: any) => void) | null = null
      readAsDataURL() {
        this.onload?.({ target: { result: 'data:image/png;base64,xx' } })
      }
    }

    // @ts-expect-error test polyfill
    global.FileReader = FR

    const wrapper = mount(DishForm)

    // too large
    await wrapper.vm.handleFileSelect({ target: { files: [createFile('a.png', 10 * 1024 * 1024 + 1, 'image/png')] } })
    expect(wrapper.vm.errors.image).toContain('10MB')

    // ok
    await wrapper.vm.handleFileSelect({ target: { files: [createFile('a.png', 1024, 'image/png')] } })
    expect(wrapper.vm.previewImage).toContain('data:image')

    // drop non-image
    await wrapper.vm.handleFileDrop({
      dataTransfer: { files: [createFile('a.txt', 1, 'text/plain')] },
    })
    expect(wrapper.vm.errors.image).toContain('图片')
  })

  it('DishForm triggerFileInput clicks underlying input', async () => {
    const wrapper = mount(DishForm)
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => undefined)

    wrapper.vm.triggerFileInput()
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('DishForm resetForm clears fields and errors', async () => {
    const wrapper = mount(DishForm)

    wrapper.vm.formData.canteen = '紫荆园'
    wrapper.vm.errors.canteen = 'x'
    wrapper.vm.previewImage = 'x'

    wrapper.vm.resetForm()
    await nextTick()
    expect(wrapper.vm.formData.canteen).toBe('')
    expect(wrapper.vm.previewImage).toBe('')
    expect(Object.keys(wrapper.vm.errors).length).toBe(0)
  })

  it('DishForm handleFileDrop image branch wires files via DataTransfer', async () => {
    // Polyfill DataTransfer for jsdom when missing
    if (!(globalThis as any).DataTransfer) {
      ;(globalThis as any).DataTransfer = class DataTransfer {
        items = {
          list: [] as any[],
          add: (file: any) => {
            this.items.list.push(file)
          },
        }
        get files() {
          return this.items.list
        }
      }
    }

    class FR {
      onload: ((e: any) => void) | null = null
      readAsDataURL() {
        this.onload?.({ target: { result: 'data:image/png;base64,yy' } })
      }
    }

    // @ts-expect-error test polyfill
    global.FileReader = FR

    const wrapper = mount(DishForm)
    // avoid jsdom FileList type enforcement on real <input>.files
    // @ts-expect-error test override
    wrapper.vm.fileInput = {}
    const file = createFile('a.png', 1024, 'image/png')

    await wrapper.vm.handleFileDrop({
      dataTransfer: { files: [file] },
    })

    expect(wrapper.vm.previewImage).toContain('data:image')
  })

  it('DishForm applies props.dish immediately', async () => {
    const wrapper = mount(DishForm, {
      props: {
        dish: {
          canteen: '桃李园',
          floor: '二层',
          window: 'W',
          name: 'N',
          image: 'http://img',
          subItems: [{ name: 's', price: '1' }],
        },
      },
    })

    expect(wrapper.vm.formData.canteen).toBe('桃李园')
    expect(wrapper.vm.previewImage).toBe('http://img')
  })
})
