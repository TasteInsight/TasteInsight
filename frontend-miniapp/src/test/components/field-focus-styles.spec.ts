import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from '@vue/compiler-sfc';
import postcss from 'postcss';

const fields = [
  {
    name: 'settings fields',
    file: 'styles/settings-page.css',
    selector: '.settings-field',
    focusStates: [':focus-within'],
  },
  {
    name: 'review sheet fields',
    file: 'styles/review-sheet.css',
    selector: '.sheet-input',
    focusStates: [':focus', ':focus-within'],
  },
  {
    name: 'profile biography field',
    file: 'pages/profile/components/ProfileBioEditor.vue',
    selector: '.profile-bio-input',
    focusStates: [':focus-within'],
  },
];

const styleFor = (file: string, selector: string) => {
  const source = readFileSync(resolve(__dirname, '../../', file), 'utf8');
  const styles = file.endsWith('.vue')
    ? parse(source).descriptor.styles.map(style => style.content)
    : [source];
  const declarations: Record<string, string> = {};
  styles.forEach(style =>
    postcss.parse(style).walkRules(rule => {
      if (!rule.selectors.includes(selector)) return;
      rule.walkDecls(declaration => {
        declarations[declaration.prop] = declaration.value;
      });
    })
  );
  return declarations;
};

describe.each(fields)('$name', ({ file, selector, focusStates }) => {
  test('retains a solid 1px input boundary outside focus', () => {
    const base = styleFor(file, selector);
    expect(base.border).toMatch(/^1px solid /);
    expect(base['box-sizing']).toBe('border-box');
  });

  test.each(focusStates)('%s uses an inward purple outline without widening the border', state => {
    const focused = styleFor(file, `${selector}${state}`);
    expect(focused).toMatchObject({
      'border-color': '#660874',
      outline: '2px solid #660874',
      'outline-offset': '-2px',
    });
    expect(Object.keys(focused).filter(property => property.startsWith('border'))).toEqual([
      'border-color',
    ]);
  });
});
