/* eslint-disable @typescript-eslint/no-var-requires */

// Artillery processor (CommonJS)
// - 支持可选登录：IGNORE_LOGIN=1 时不走登录
// - 登录接口：/auth/wechat/login 需要 WECHAT_CODE（真实后端可能要求真 code）
// - 也支持直接提供 TOKEN（优先）

function maybeLogin(context, events, done) {
  const ignore = process.env.IGNORE_LOGIN === '1' || process.env.IGNORE_LOGIN === 'true'
  if (ignore) {
    context.vars.token = process.env.TOKEN || context.vars.token || ''
    return done()
  }

  // 如果已提供 TOKEN，就不再登录
  if (process.env.TOKEN) {
    context.vars.token = process.env.TOKEN
    return done()
  }

  const wechatCode = process.env.WECHAT_CODE
  if (!wechatCode) {
    // 没法自动登录：退化为匿名（有些接口会 401，依然能体现错误率）
    events.emit('counter', 'load.login.skipped_missing_code', 1)
    context.vars.token = ''
    return done()
  }

  const target = context._config.target
  const url = new URL('/auth/wechat/login', target).toString()

  const fetchImpl = globalThis.fetch || require('node-fetch')

  fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: wechatCode }),
  })
    .then(async (res) => {
      const json = await res.json().catch(() => ({}))
      // 兼容不同后端返回
      const token =
        json?.data?.accessToken ||
        json?.data?.token ||
        json?.accessToken ||
        json?.token ||
        ''

      context.vars.token = token
      if (!token) events.emit('counter', 'load.login.missing_token', 1)
      done()
    })
    .catch(() => {
      events.emit('counter', 'load.login.failed', 1)
      context.vars.token = ''
      done()
    })
}

function captureSessionId(context, events, done) {
  // 从上一条 /ai/sessions 的响应中抓 sessionId
  const last = context.vars.$response
  const body = last?.body

  let parsed
  if (typeof body === 'string') {
    try {
      parsed = JSON.parse(body)
    } catch {
      parsed = undefined
    }
  } else {
    parsed = body
  }

  const sessionId =
    parsed?.data?.id ||
    parsed?.data?.sessionId ||
    parsed?.id ||
    parsed?.sessionId ||
    ''

  context.vars.sessionId = sessionId || context.vars.sessionId || 'session_001'
  if (!sessionId) events.emit('counter', 'load.ai.sessionId.missing', 1)
  done()
}

function maybeAdminLogin(context, events, done) {
  const ignore = process.env.IGNORE_ADMIN_LOGIN === '1' || process.env.IGNORE_ADMIN_LOGIN === 'true'
  if (ignore) {
    context.vars.adminToken = process.env.ADMIN_TOKEN || context.vars.adminToken || ''
    return done()
  }

  if (process.env.ADMIN_TOKEN) {
    context.vars.adminToken = process.env.ADMIN_TOKEN
    return done()
  }

  // 假设管理端登录接口是 /auth/admin/login，需要 username/password
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD
  if (!username || !password) {
    events.emit('counter', 'load.admin_login.skipped_missing_creds', 1)
    context.vars.adminToken = ''
    return done()
  }

  const target = context._config.target
  const url = new URL('/auth/admin/login', target).toString()

  const fetchImpl = globalThis.fetch || require('node-fetch')

  fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
    .then(async (res) => {
      const json = await res.json().catch(() => ({}))
      const token =
        json?.data?.accessToken ||
        json?.data?.token ||
        json?.accessToken ||
        json?.token ||
        ''

      context.vars.adminToken = token
      if (!token) events.emit('counter', 'load.admin_login.missing_token', 1)
      done()
    })
    .catch(() => {
      events.emit('counter', 'load.admin_login.failed', 1)
      context.vars.adminToken = ''
      done()
    })
}

module.exports = {
  maybeLogin,
  captureSessionId,
  maybeAdminLogin,
}
