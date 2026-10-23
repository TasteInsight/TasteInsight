import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import ExperimentMetrics from '@/components/ExperimentMetrics.vue'
import { experimentApi } from '@/api/modules/experiment'
vi.mock('@/api/modules/experiment', () => ({ experimentApi: { getMetrics: vi.fn() } }))
const api = vi.mocked(experimentApi.getMetrics)
beforeEach(() => vi.clearAllMocks())
it('displays actual exposure denominators and empty-sample rates separately from deliveries', async () => {
  api.mockResolvedValue({
    code: 200,
    message: 'ok',
    data: {
      metricVersion: 2,
      groups: [
        {
          groupItemId: 'g1',
          deliveries: 50,
          impressions: 10,
          clicks: 2,
          favorites: 1,
          ctr: 0.2,
          favoriteRate: 0.1,
          fallbacks: 5,
          avgLatencyMs: 24,
        },
        {
          groupItemId: 'g2',
          deliveries: 1,
          impressions: 0,
          clicks: 0,
          favorites: 0,
          ctr: 0,
          favoriteRate: 0,
          fallbacks: 0,
          avgLatencyMs: 20,
        },
      ],
    },
  })
  const wrapper = mount(ExperimentMetrics, {
    props: { experimentId: 'e1', groups: [{ id: 'g1', name: '基线', ratio: 1 }] },
  })
  await flushPromises()
  const rows = wrapper.findAll('tbody tr')
  expect(rows[0].text()).toContain('20.00%')
  expect(rows[0].text()).toContain('10.00%')
  expect(rows[0].text()).toContain('50.00%')
  expect(rows[1].findAll('td')[4].text()).toBe('—')
  await wrapper.find('select').setValue('30')
  await flushPromises()
  expect(api).toHaveBeenLastCalledWith('e1', 30)
  wrapper.unmount()
})
it('discards a previous experiment response after navigation', async () => {
  let first!: (value: any) => void
  api.mockReturnValueOnce(
    new Promise((resolve) => {
      first = resolve
    }),
  )
  api.mockResolvedValueOnce({ code: 200, message: 'ok', data: { metricVersion: 2, groups: [] } })
  const wrapper = mount(ExperimentMetrics, { props: { experimentId: 'old', groups: [] } })
  await wrapper.setProps({ experimentId: 'new' })
  await flushPromises()
  first({ code: 500, message: 'old error' })
  await flushPromises()
  expect(wrapper.text()).not.toContain('old error')
  expect(wrapper.text()).toContain('暂无样本')
  wrapper.unmount()
})
