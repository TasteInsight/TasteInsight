type Handoff = {
  attemptId: string;
  handoffCode: string;
  handoffExpiresAt: string;
  clientOrigin: string | null;
  purpose?: string;
  account?: { id: string; nickname: string; phone?: string };
};

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!,
  );

export function campusOAuthPage(nonce: string, handoff?: Handoff): string {
  const login = handoff?.purpose === 'LOGIN';
  const binding = handoff?.purpose === 'LOGIN_BIND';
  const title = handoff
    ? login
      ? '确认校园账号登录'
      : binding
        ? '确认校园登录绑定'
        : '确认学生身份绑定'
    : '认证未完成';
  const account = handoff?.account;
  const content = handoff
    ? `${
        login
          ? '<p>校方授权已完成。请返回发起本次授权的食鉴登录页面，确认登录。</p>'
          : `<p>${binding ? '该校园账号将用于登录以下食鉴账号，请核对后继续。' : '请核对即将绑定校园身份的食鉴账号。'}</p>
      <dl><dt>昵称</dt><dd>${escapeHtml(account!.nickname)}</dd>
      <dt>账号 ID</dt><dd>${escapeHtml(account!.id)}</dd>
      ${account!.phone ? `<dt>登录手机号</dt><dd>${escapeHtml(account!.phone)}</dd>` : ''}</dl>
      <p>仅为自己发起认证的账号继续操作。如果这不是你的账号，请关闭此页。</p>`
      }
      <button id="confirm" type="button">${login ? '返回食鉴确认登录' : '确认此账号，返回食鉴绑定'}</button>
      <section id="handoff" hidden data-attempt="${escapeHtml(handoff.attemptId)}" data-origin="${escapeHtml(handoff.clientOrigin ?? '')}" data-expiry="${escapeHtml(handoff.handoffExpiresAt)}">
        <p>复制确认码，返回食鉴的「${login ? '登录' : '校园身份'}」页面，粘贴后${login ? '确认登录' : '确认绑定'}。确认码有效期为 3 分钟，请勿发给他人。</p>
        <label for="code">一次性确认码</label><textarea id="code" readonly rows="2" spellcheck="false">${escapeHtml(handoff.handoffCode)}</textarea>
        <button id="copy" type="button">复制确认码</button>
      </section><p id="message" role="status" aria-live="polite"></p>
      <noscript><p>请启用浏览器 JavaScript，再重新发起认证。</p></noscript>`
    : '<p>授权未完成、请求已过期或认证服务暂时不可用。请返回食鉴重新发起认证。</p>';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · 食鉴</title>
    <style nonce="${nonce}">
      *{box-sizing:border-box}body{margin:0;background:#fff;color:#1f2937;font:16px/1.65 system-ui,sans-serif}main{max-width:580px;margin:48px auto;padding:0 24px 40px}h1{font-size:26px;line-height:1.3;margin:0 0 24px}p{margin:16px 0;color:#475467}dl{padding:20px 0;border-block:1px solid #eaecf0}dt{font-size:14px;color:#667085}dd{margin:0 0 12px;overflow-wrap:anywhere}dd:last-child{margin-bottom:0}button{border:0;border-radius:10px;min-height:46px;padding:12px 18px;font:inherit;font-weight:600;background:#660874;color:#fff;cursor:pointer}button:disabled{background:#eaecf0;color:#667085;cursor:default}button:focus-visible,textarea:focus-visible{outline:2px solid #660874;outline-offset:3px}label{display:block;margin-bottom:8px}textarea{width:100%;resize:none;border:1px solid #98a2b3;border-radius:8px;background:#fff;padding:12px;font:16px/1.5 monospace;color:#1f2937;caret-color:#660874}::selection{background:#660874;color:#fff}section{margin-top:24px}#message{min-height:26px}@media(max-width:420px){main{margin-top:32px;padding-inline:20px}button{width:100%}}
    </style></head><body><main><h1>${title}</h1>${content}</main>
    ${
      handoff
        ? `<script nonce="${nonce}">
      const section = document.getElementById('handoff');
      const code = document.getElementById('code');
      const confirm = document.getElementById('confirm');
      const copy = document.getElementById('copy');
      const message = document.getElementById('message');
      const expiresAt = Date.parse(section.dataset.expiry);
      const expired = () => {
        if (Date.now() < expiresAt) return false;
        confirm.disabled = true; copy.disabled = true; code.value = '';
        message.textContent = '确认码已过期，请返回食鉴重新发起认证。';
        return true;
      };
      confirm.addEventListener('click', () => {
        if (expired()) return;
        section.hidden = false; confirm.disabled = true;
        const targetOrigin = section.dataset.origin;
        if (targetOrigin && window.opener) {
          window.opener.postMessage({ type: '${login ? 'tasteinsight:campus-login' : 'tasteinsight:campus-oauth'}', ${binding ? "purpose: 'LOGIN_BIND'," : ''} attemptId: section.dataset.attempt, handoffCode: code.value }, targetOrigin);
        }
        message.textContent = '${login ? '请返回食鉴确认登录。' : binding ? '请返回食鉴确认绑定登录方式。' : '请返回食鉴确认绑定；尚未授予学生权限。'}';
      });
      copy.addEventListener('click', async () => {
        if (expired()) return;
        try {
          if (!navigator.clipboard) throw new Error();
          await navigator.clipboard.writeText(code.value);
          message.textContent = '确认码已复制，请返回食鉴粘贴并${login ? '确认登录' : '确认绑定'}。';
        } catch {
          code.focus(); code.select();
          message.textContent = '请长按或手动复制已选中的确认码。';
        }
      });
      if (!expired()) setTimeout(expired, Math.max(0, expiresAt - Date.now()));
    </script>`
        : ''
    }</body></html>`;
}
