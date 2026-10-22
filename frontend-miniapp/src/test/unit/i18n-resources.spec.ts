import { locale, messages, t } from '@/i18n';

function flatten(value: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof item === 'string'
        ? [[path, item]]
        : Object.entries(flatten(item as Record<string, unknown>, path));
    })
  );
}
const parameters = (value: string) =>
  [...new Set([...value.matchAll(/\{\s*([A-Za-z_]\w*)\s*\}/g)].map(match => match[1]))].sort();

test('both languages provide the same messages and named parameters', () => {
  const zh = flatten(messages['zh-Hans']);
  const en = flatten(messages.en);
  expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
  for (const key of Object.keys(zh))
    expect({ key, params: parameters(en[key]) }).toEqual({ key, params: parameters(zh[key]) });
});

test('all shipped messages compile with vue-i18n', () => {
  const original = locale.value;
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    for (const language of ['zh-Hans', 'en'] as const) {
      locale.value = language;
      for (const [key, text] of Object.entries(flatten(messages[language]))) {
        const values = Object.fromEntries(
          parameters(text).map(name => [name, name === 'count' ? 2 : 'test'])
        );
        expect(t(key, values)).not.toBe(key);
      }
    }
    expect(error.mock.calls).toEqual([]);
  } finally {
    locale.value = original;
    error.mockRestore();
  }
});
