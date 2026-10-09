import { mount } from '@vue/test-utils';
import TasteProfile from '@/pages/dish/components/TasteProfile.vue';

const fields = [
  ['spicyLevel', '辣度'],
  ['sweetness', '甜度'],
  ['saltiness', '咸度'],
  ['oiliness', '油腻度'],
] as const;

test.each(
  fields.flatMap(([field, label]) => [1, 2, 3, 4, 5].map(level => [field, label, level] as const))
)('%s renders intensity %s with its original accessible degree (%s)', (field, label, level) => {
  const taste = { [field]: level };
  const wrapper = mount(TasteProfile, { props: { taste } });
  const item = wrapper.get(`[data-taste="${field}"]`);
  expect(item.findAll('.taste-segment')).toHaveLength(5);
  expect(item.findAll('.taste-segment-active')).toHaveLength(level);
  expect(item.attributes('aria-label')).toBe(`${label}，强度 ${level}，共 5 级，从低到高`);
  expect(item.attributes('role')).toBe('img');
  expect(wrapper.text()).not.toContain('/5');
  expect(wrapper.text()).not.toMatch(/[★☆]/);
  expect(taste[field]).toBe(level);
  wrapper.unmount();
});

test.each([0, undefined, null])(
  'unknown value %s is not presented as the lowest taste intensity',
  value => {
    const taste = Object.fromEntries(fields.map(([field]) => [field, value]));
    const wrapper = mount(TasteProfile, { props: { taste } });
    expect(wrapper.findAll('.taste-profile-item')).toHaveLength(4);
    expect(wrapper.findAll('.taste-unknown')).toHaveLength(4);
    expect(wrapper.findAll('.taste-segment')).toHaveLength(0);
    fields.forEach(([field, label]) => {
      const item = wrapper.get(`[data-taste="${field}"]`);
      expect(item.text()).toContain('暂无信息');
      expect(item.attributes('aria-label')).toBe(`${label}，暂无信息`);
    });
    expect(wrapper.text()).not.toContain('不辣');
    wrapper.unmount();
  }
);

test('all four taste fields keep their own intensity and update with the supplied data', async () => {
  const wrapper = mount(TasteProfile, {
    props: { taste: { spicyLevel: 1, sweetness: 2, saltiness: 3, oiliness: 5 } },
  });
  expect(wrapper.findAll('.taste-label').map(label => label.text())).toEqual([
    '辣度',
    '甜度',
    '咸度',
    '油腻度',
  ]);
  expect(
    wrapper.findAll('.taste-profile-item').map(item => item.findAll('.taste-segment-active').length)
  ).toEqual([1, 2, 3, 5]);
  expect(wrapper.get('.taste-direction').text()).toBe('低 → 高');
  await wrapper.setProps({ taste: { spicyLevel: 0, sweetness: 5, saltiness: 1, oiliness: 2 } });
  expect(wrapper.get('[data-taste="spicyLevel"]').text()).toContain('暂无信息');
  expect(wrapper.get('[data-taste="sweetness"]').findAll('.taste-segment-active')).toHaveLength(5);
  wrapper.unmount();
});

test('collapsible taste details start hidden and can be reopened without losing their values', async () => {
  const wrapper = mount(TasteProfile, {
    props: { taste: { spicyLevel: 1, sweetness: 2, saltiness: 3, oiliness: 4 }, collapsible: true },
  });
  try {
    expect(wrapper.get('.taste-grid').isVisible()).toBe(false);
    const toggle = wrapper.get('.taste-toggle');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    expect(toggle.attributes('aria-controls')).toBe(wrapper.get('.taste-grid').attributes('id'));
    await toggle.trigger('tap');
    expect(toggle.attributes('aria-expanded')).toBe('true');
    expect(wrapper.get('.taste-grid').isVisible()).toBe(true);
    expect(
      wrapper
        .findAll('.taste-profile-item')
        .map(item => item.findAll('.taste-segment-active').length)
    ).toEqual([1, 2, 3, 4]);
    await toggle.trigger('tap');
    expect(wrapper.get('.taste-grid').isVisible()).toBe(false);
    await toggle.trigger('tap');
    expect(wrapper.get('[data-taste="oiliness"]').findAll('.taste-segment-active')).toHaveLength(4);
  } finally {
    wrapper.unmount();
  }
});

test.each(['Enter', ' '])(
  'toggles taste details by the %s key without notifying a parent tap handler',
  async key => {
    const wrapper = mount(TasteProfile, {
      props: {
        taste: { spicyLevel: 1, sweetness: 2, saltiness: 3, oiliness: 4 },
        collapsible: true,
      },
    });
    try {
      const parentTap = jest.fn();
      wrapper.element.addEventListener('tap', parentTap);
      await wrapper.get('.taste-toggle').trigger('keydown', { key });
      expect(wrapper.get('.taste-grid').isVisible()).toBe(true);
      await wrapper.get('.taste-toggle').trigger('tap');
      expect(wrapper.get('.taste-grid').isVisible()).toBe(false);
      expect(parentTap).not.toHaveBeenCalled();
    } finally {
      wrapper.unmount();
    }
  }
);

test('keeps an opened disclosure open when its values are refreshed', async () => {
  const wrapper = mount(TasteProfile, {
    props: { taste: { spicyLevel: 1, sweetness: 2, saltiness: 3, oiliness: 4 }, collapsible: true },
  });
  try {
    await wrapper.get('.taste-toggle').trigger('tap');
    await wrapper.setProps({ taste: { spicyLevel: 2, sweetness: 4, saltiness: 0, oiliness: 1 } });
    expect(wrapper.get('.taste-grid').isVisible()).toBe(true);
    expect(wrapper.get('[data-taste="sweetness"]').findAll('.taste-segment-active')).toHaveLength(
      4
    );
    expect(wrapper.get('[data-taste="saltiness"]').text()).toContain('暂无信息');
  } finally {
    wrapper.unmount();
  }
});

test('keeps the supplied overall rating visible while its taste details are toggled', async () => {
  const wrapper = mount(TasteProfile, {
    props: { taste: { spicyLevel: 1, sweetness: 2, saltiness: 3, oiliness: 4 }, collapsible: true },
    slots: { summary: '<span class="overall-rating" aria-label="总体评分 4 星">★★★★☆</span>' },
  });
  try {
    expect(wrapper.get('.overall-rating').isVisible()).toBe(true);
    expect(wrapper.get('.overall-rating').attributes('aria-label')).toBe('总体评分 4 星');
    expect(wrapper.get('.taste-grid').isVisible()).toBe(false);
    await wrapper.get('.taste-toggle').trigger('tap');
    expect(wrapper.get('.overall-rating').isVisible()).toBe(true);
    expect(wrapper.get('.taste-grid').isVisible()).toBe(true);
    await wrapper.get('.taste-toggle').trigger('tap');
    expect(wrapper.get('.overall-rating').isVisible()).toBe(true);
    expect(wrapper.get('.taste-grid').isVisible()).toBe(false);
  } finally {
    wrapper.unmount();
  }
});

test.each([undefined, null])(
  'keeps the rating without an empty disclosure when taste details are %s',
  async taste => {
    const wrapper = mount(TasteProfile, {
      props: { taste, collapsible: true },
      slots: { summary: '<span class="overall-rating">★★★★☆</span>' },
    });
    try {
      expect(wrapper.get('.overall-rating').isVisible()).toBe(true);
      expect(wrapper.find('.taste-toggle').exists()).toBe(false);
      expect(wrapper.find('.taste-grid').exists()).toBe(false);
      await wrapper.setProps({
        taste: { spicyLevel: 1, sweetness: 2, saltiness: 3, oiliness: 4 },
      });
      expect(wrapper.get('.overall-rating').isVisible()).toBe(true);
      expect(wrapper.get('.taste-grid').isVisible()).toBe(false);
      await wrapper.get('.taste-toggle').trigger('tap');
      expect(wrapper.get('[data-taste="oiliness"]').findAll('.taste-segment-active')).toHaveLength(
        4
      );
    } finally {
      wrapper.unmount();
    }
  }
);
