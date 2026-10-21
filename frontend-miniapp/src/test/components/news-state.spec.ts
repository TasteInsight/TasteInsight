import { flushPromises, shallowMount } from '@vue/test-utils';
import { onLoad } from '@dcloudio/uni-app';
import NewsFeed from '@/pages/news/components/NewsFeed.vue';
import NewsDetail from '@/pages/news/components/detail.vue';
import { getNewsList, getNewsById } from '@/api/modules/news';

jest.mock('@dcloudio/uni-app', () => ({ onLoad: jest.fn() }));
jest.mock('@/api/modules/news', () => ({ getNewsList: jest.fn(), getNewsById: jest.fn() }));
const options = { global: { stubs: { AsyncState: false, EmptyState: false } } };
const result = (items: any[] = []) => ({
  code: 200,
  data: { items, meta: { page: 1, totalPages: 1 } },
});
const deferred = () => {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>(done => {
    resolve = done;
  });
  return { promise, resolve };
};
beforeEach(() => jest.resetAllMocks());

test('news is first read on activation and returns from a hidden pane with cached data', async () => {
  const pending = deferred();
  (getNewsList as jest.Mock).mockReturnValueOnce(pending.promise);
  const wrapper = shallowMount(NewsFeed, { ...options, props: { active: false } });
  expect(getNewsList).not.toHaveBeenCalled();
  await wrapper.setProps({ active: true });
  expect(wrapper.text()).toContain('正在加载新闻…');
  await wrapper.setProps({ active: false });
  pending.resolve(result([{ id: 'news', title: '今日公告' }]));
  await flushPromises();
  await wrapper.setProps({ active: true });
  expect(getNewsList).toHaveBeenCalledTimes(1);
  expect(wrapper.findAll('news-item-stub')).toHaveLength(1);
  wrapper.unmount();
});

test('refreshing an empty announcement feed replaces its empty feedback', async () => {
  (getNewsList as jest.Mock).mockResolvedValueOnce(result());
  const wrapper = shallowMount(NewsFeed, options);
  await flushPromises();
  expect(wrapper.text()).toContain('暂无新闻');
  const pending = deferred();
  (getNewsList as jest.Mock).mockReturnValueOnce(pending.promise);
  const refresh = (wrapper.vm as any).refresh();
  await flushPromises();
  expect(wrapper.text()).toContain('正在加载新闻…');
  expect(wrapper.text()).not.toContain('暂无新闻');
  pending.resolve(result());
  await refresh;
  wrapper.unmount();
});

test('article refresh exposes feedback while retaining the loaded article', async () => {
  const article = { id: 'news', title: '今日公告', content: '内容' };
  (getNewsById as jest.Mock).mockResolvedValueOnce({ code: 200, data: article });
  const wrapper = shallowMount(NewsDetail, options);
  await (onLoad as jest.Mock).mock.calls[0][0]({ id: 'news' });
  await flushPromises();
  const pending = deferred();
  (getNewsById as jest.Mock).mockReturnValueOnce(pending.promise);
  const refresh = (wrapper.vm as any).retry();
  await flushPromises();
  expect(wrapper.get('.article-title').text()).toBe('今日公告');
  expect(wrapper.text()).toContain('正在更新…');
  pending.resolve({ code: 200, data: article });
  await refresh;
  wrapper.unmount();
});
