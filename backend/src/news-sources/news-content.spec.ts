import {
  cleanNewsContent,
  newsSummary,
  wechatArticleUrl,
} from './news-content';
describe('imported news content', () => {
  it('keeps nested sections, colors, spacing, and visible lazy images', () => {
    const html = cleanNewsContent(
      '<section style="padding:12px;background-color:#f4f4f4"><p style="text-align:center;color:red">正文</p><img data-src="https://mmbiz.qpic.cn/photo" style="width:100%;opacity:0" onerror="bad()"></section>',
    );
    expect(html).toContain('<section');
    expect(html).toContain('padding:12px');
    expect(html).toContain('text-align:center');
    expect(html).toContain('src="https://mmbiz.qpic.cn/photo"');
    expect(html).not.toMatch(/opacity|onerror/);
  });
  it('preserves safe grid overlays and aspect ratios used by illustrated articles', () => {
    const html = cleanNewsContent(
      '<section style="display:grid;aspect-ratio:2.9155 / 1;grid-template-columns:100%;grid-template-rows:100%;overflow:hidden"><section style="grid-column-start:1;grid-row-start:1">标题</section></section>',
    );
    expect(html).toContain('aspect-ratio:2.9155 / 1');
    expect(html).toContain('grid-template-columns:100%');
    expect(html).toContain('grid-row-start:1');
  });
  it('removes executable elements, event handlers and CSS resource loads', () => {
    const html = cleanNewsContent(
      '<script>alert(1)</script><iframe src="https://evil.test"></iframe><section onclick="evil()" style="background-image:url(https://evil.test);position:fixed"><a href="javascript:evil()">链接</a></section>',
    );
    expect(html).not.toMatch(
      /script|iframe|onclick|background-image|position|javascript/,
    );
  });
  it('validates the exact WeChat origin and article route', () => {
    expect(wechatArticleUrl('https://mp.weixin.qq.com/s/token#rd')).toBe(
      'https://mp.weixin.qq.com/s/token',
    );
    for (const url of [
      'http://mp.weixin.qq.com/s/x',
      'https://mp.weixin.qq.com.evil.test/s/x',
      'https://mp.weixin.qq.com@evil.test/s/x',
      'https://user@mp.weixin.qq.com/s/x',
      'https://mp.weixin.qq.com/mp/homepage',
    ])
      expect(wechatArticleUrl(url)).toBeNull();
  });
  it('summarizes text with entities decoded and spaced', () => {
    expect(newsSummary('<p>食堂&nbsp; 上新</p><p>欢迎</p>')).toBe(
      '食堂 上新欢迎',
    );
  });
});
