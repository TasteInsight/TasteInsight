import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from '@vue/compiler-sfc';
import postcss from 'postcss';

const styleFor = (file: string, selector: string) => {
  const { descriptor } = parse(
    readFileSync(resolve(__dirname, '../../pages/ai-chat', file), 'utf8')
  );
  const declarations: Record<string, string> = {};
  descriptor.styles.forEach(style =>
    postcss.parse(style.content).walkRules(selector, rule => {
      rule.walkDecls(declaration => {
        declarations[declaration.prop] = declaration.value;
      });
    })
  );
  return declarations;
};

test('dish names lead the reply typography while planning remains secondary', () => {
  const body = styleFor('index.vue', '.chat-bubble');
  const dish = styleFor('components/DishCard.vue', '.dish-recommendation-name');
  const plan = styleFor('components/PlanningCard.vue', '.planning-card-title');
  expect(parseFloat(dish['font-size'])).toBeGreaterThan(parseFloat(body['font-size']));
  expect(parseFloat(plan['font-size'])).toBeLessThan(parseFloat(body['font-size']));
  expect(parseFloat(plan['font-weight'])).toBeLessThan(parseFloat(dish['font-weight']));
});

test('reply edges do not add margins to the spacing owned by neighboring content', () => {
  expect(styleFor('index.vue', '.chat-bubble')['margin-bottom']).toBe('0');
  expect(
    styleFor('components/MarkdownText.vue', ':deep(.markdown-body > :first-child)')['margin-top']
  ).toBe('0');
  expect(
    styleFor('components/MarkdownText.vue', ':deep(.markdown-body > :last-child)')['margin-bottom']
  ).toBe('0');
  expect(
    styleFor('index.vue', '.chat-segment + .chat-segment-text')['margin-top']
  ).toBe('16px');
});
