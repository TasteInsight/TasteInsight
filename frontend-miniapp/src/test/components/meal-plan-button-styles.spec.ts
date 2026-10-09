import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from '@vue/compiler-sfc';
import postcss from 'postcss';
import { mount } from '@vue/test-utils';
import BottomReviewInput from '@/pages/dish/components/BottomReviewInput.vue';

const components = [
  ['components/meal-plan/PlanEditDialog.vue', 'plan-button'],
  ['pages/dish/components/BottomReviewInput.vue', 'dish-action-button'],
  ['pages/planning/components/PlanCard.vue', 'meal-card-button'],
  ['pages/planning/components/PlanDetailDialog.vue', 'meal-detail-button'],
] as const;

test.each(components.filter(([, buttonClass]) => buttonClass !== 'meal-card-button'))(
  '%s centers button content independently of the native default line height',
  (file, buttonClass) => {
    const { descriptor } = parse(readFileSync(resolve(__dirname, '../../', file), 'utf8'));
    const declarations: Record<string, string> = {};
    descriptor.styles.forEach(style =>
      postcss.parse(style.content).walkRules(`.${buttonClass}`, rule => {
        rule.walkDecls(declaration => {
          declarations[declaration.prop] = declaration.value;
        });
      })
    );
    expect(declarations).toMatchObject({
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
    });
  }
);

test.each(components)(
  '%s attaches its class-based button styles to every button',
  (file, buttonClass) => {
    const source = readFileSync(resolve(__dirname, '../../', file), 'utf8');
    const { descriptor } = parse(source);
    const buttons: any[] = [];
    const visit = (node: any) => {
      if (node.tag === 'button') buttons.push(node);
      node.children?.forEach(visit);
    };
    visit(descriptor.template!.ast);
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach(button => {
      const classes = button.props
        .find((prop: any) => prop.name === 'class')
        ?.value?.content.split(/\s+/);
      expect(classes).toContain(buttonClass);
    });
    const selectors: string[] = [];
    descriptor.styles.forEach(style =>
      postcss.parse(style.content).walkRules(rule => {
        selectors.push(rule.selector);
        expect(rule.selector).not.toMatch(/(^|[\s>+~,])(?:[a-z][\w-]*|\*)\b/i);
        expect(rule.selector).not.toContain('[');
      })
    );
    expect(selectors).toEqual(
      expect.arrayContaining([
        `.${buttonClass}`,
        `.${buttonClass}::after`,
        `.${buttonClass}:active`,
        `.${buttonClass}:focus-visible`,
      ])
    );
  }
);

test('review is the sole primary action while favorite and planning retain separate events', async () => {
  const wrapper = mount(BottomReviewInput, {
    props: { isFavorited: false, favoriteLoading: true },
  });
  const favorite = wrapper.get('[aria-label="收藏此菜品"]');
  expect(favorite.classes()).toContain('dish-action-disabled');
  expect(favorite.attributes('disabled')).toBeDefined();
  await favorite.trigger('click');
  expect(wrapper.emitted('favorite')).toBeUndefined();
  await wrapper.setProps({ favoriteLoading: false });
  expect(favorite.classes()).not.toContain('dish-action-disabled');
  expect(favorite.attributes('disabled')).toBeUndefined();
  await favorite.trigger('click');
  expect(wrapper.emitted('favorite')).toHaveLength(1);
  expect(wrapper.findAll('.dish-action-primary')).toHaveLength(1);
  expect(wrapper.get('.dish-action-primary').text()).toBe('写评价');
  await wrapper.get('.dish-action-primary').trigger('click');
  expect(wrapper.emitted('review')).toHaveLength(1);
  expect(wrapper.emitted('plan')).toBeUndefined();
  const planning = wrapper.get('[aria-label="加入规划"]');
  expect(planning.classes()).toContain('dish-action-secondary');
  await planning.trigger('click');
  expect(wrapper.emitted('plan')).toHaveLength(1);
  await wrapper.setProps({ hasReview: true });
  expect(wrapper.get('.dish-action-primary').text()).toBe('修改评价');
  expect(wrapper.get('.dish-action-primary').attributes('aria-label')).toBe('修改评价');
  wrapper.unmount();
});
