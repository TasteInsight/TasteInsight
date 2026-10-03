import { StreamingResponseFilter } from './streaming-response-filter.util';

function filterChunks(chunks: string[]): string {
  const filter = new StreamingResponseFilter();
  return chunks.map((chunk) => filter.push(chunk)).join('') + filter.flush();
}

describe('StreamingResponseFilter', () => {
  it('waits for the credential value after a separator at the end of a chunk', () => {
    expect(filterChunks(['api_key=', ' raw-secret'])).toBe('[REDACTED]');
    expect(filterChunks(['password:', '\n ', 'p@ss.word/123!', ' next'])).toBe(
      '[REDACTED] next',
    );
  });

  it.each([
    ['api_key  =  raw-secret next', '[REDACTED] next'],
    ['before password:\n\t p@ss.word/123! after', 'before [REDACTED] after'],
    ['SECRET = value\npublic text', '[REDACTED]\npublic text'],
    ['api-key=first password = second end', '[REDACTED] [REDACTED] end'],
    ['postgresql://user:pass@db:5432/name next', '[REDACTED] next'],
    ['redis://:password@cache:6379/0\nnext', '[REDACTED]\nnext'],
    ['普通文字 passwordless secret menu', '普通文字 passwordless secret menu'],
    [
      'api-key is a label, not a credential',
      'api-key is a label, not a credential',
    ],
  ])(
    'keeps filtering independent of chunk boundaries: %s',
    (input, expected) => {
      expect(filterChunks(Array.from(input))).toBe(expected);
      for (let first = 0; first <= input.length; first += 1) {
        for (let second = first; second <= input.length; second += 1) {
          expect(
            filterChunks([
              input.slice(0, first),
              input.slice(first, second),
              input.slice(second),
            ]),
          ).toBe(expected);
        }
      }
    },
  );

  it('preserves the whitespace following a value that spans chunks', () => {
    expect(filterChunks(['password=', ' one', '-two', ' three'])).toBe(
      '[REDACTED] three',
    );
  });

  it('releases ordinary text without waiting for the whole response', () => {
    const filter = new StreamingResponseFilter();
    expect(filter.push('推荐清蒸鱼。')).toBe('推荐清蒸鱼。');
    expect(filter.flush()).toBe('');
  });
});
