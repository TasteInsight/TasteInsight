/*
  Minimal mock API server for Artillery load tests.
  Purpose: allow load tests to run in this repo without a separate backend.

  Start:
    pnpm load:mock-api

  Then run:
    pnpm test:load:smoke
*/

const http = require('http');
const { URL } = require('url');

const PORT = Number(process.env.MOCK_API_PORT || 3000);

function json(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(text);
}

function notFound(res) {
  json(res, 404, { message: 'Not Found' });
}

function ok(res, data) {
  json(res, 200, { data, message: 'ok' });
}

function readJson(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function match(pathname, pattern) {
  // pattern like /canteens/:canteenId/windows
  const a = pathname.split('/').filter(Boolean);
  const b = pattern.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    const part = b[i];
    if (part.startsWith(':')) params[part.slice(1)] = a[i];
    else if (part !== a[i]) return null;
  }
  return params;
}

const server = http.createServer(async (req, res) => {
  if (!req.url) return notFound(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const { pathname } = url;

  // health
  if (req.method === 'GET' && pathname === '/health') return ok(res, { status: 'ok' });

  // auth
  if (req.method === 'POST' && pathname === '/auth/wechat/login') {
    await readJson(req);
    return ok(res, { accessToken: 'mock-user-token' });
  }
  if (req.method === 'POST' && pathname === '/auth/admin/login') {
    await readJson(req);
    return ok(res, { accessToken: 'mock-admin-token' });
  }

  // canteen/window/dish graph
  if (req.method === 'GET' && pathname === '/canteens') {
    return ok(res, [{ id: 'canteen_001', name: '一食堂' }]);
  }
  {
    const params = match(pathname, '/canteens/:canteenId/windows');
    if (req.method === 'GET' && params) {
      return ok(res, [{ id: 'window_001', canteenId: params.canteenId, name: '川味窗口' }]);
    }
  }
  {
    const params = match(pathname, '/windows/:windowId/dishes');
    if (req.method === 'GET' && params) {
      return ok(res, [{ id: 'dish_001', windowId: params.windowId, name: '宫保鸡丁' }]);
    }
  }

  // dishes
  {
    const params = match(pathname, '/dishes/:dishId');
    if (req.method === 'GET' && params) {
      return ok(res, { id: params.dishId, name: '宫保鸡丁', reviewCount: 128, averageRating: 4.5 });
    }
  }
  {
    const params = match(pathname, '/dishes/:dishId/reviews');
    if (req.method === 'GET' && params) {
      return ok(res, [{ id: 'review_001', dishId: params.dishId, rating: 5, content: 'mock' }]);
    }
  }
  if (req.method === 'POST' && pathname === '/dishes') {
    await readJson(req);
    return ok(res, { items: [{ id: 'dish_001', name: '宫保鸡丁' }], total: 1 });
  }
  {
    const params = match(pathname, '/dishes/:dishId/favorite');
    if ((req.method === 'POST' || req.method === 'DELETE') && params) {
      return ok(res, { dishId: params.dishId, favorited: req.method === 'POST' });
    }
  }

  // user
  if (req.method === 'GET' && pathname === '/user/profile') {
    return ok(res, { id: 'user_001', nickname: 'mock', avatar: '' });
  }
  if (req.method === 'PUT' && pathname === '/user/profile') {
    const payload = await readJson(req);
    return ok(res, { ...payload, id: 'user_001' });
  }
  if (req.method === 'GET' && pathname === '/user/settings') {
    return ok(res, { displaySettings: { sortBy: 'rating' }, notifications: { enabled: true } });
  }
  if (req.method === 'PUT' && pathname === '/user/settings') {
    const payload = await readJson(req);
    return ok(res, payload);
  }

  // notifications
  if (req.method === 'GET' && pathname === '/notifications') {
    return ok(res, [{ id: 'notif_001', message: 'mock notification' }]);
  }

  // comments
  {
    const params = match(pathname, '/comments/:reviewId');
    if (req.method === 'GET' && params) {
      return ok(res, [{ id: 'comment_001', reviewId: params.reviewId, content: 'mock' }]);
    }
  }
  if (req.method === 'POST' && pathname === '/comments') {
    await readJson(req);
    return ok(res, { id: 'comment_new' });
  }
  {
    const params = match(pathname, '/comments/:commentId/report');
    if (req.method === 'POST' && params) {
      await readJson(req);
      return ok(res, { ok: true, commentId: params.commentId });
    }
  }

  // reviews
  if (req.method === 'POST' && pathname === '/reviews') {
    await readJson(req);
    return ok(res, { id: 'review_new' });
  }
  {
    const params = match(pathname, '/reviews/:reviewId/report');
    if (req.method === 'POST' && params) {
      await readJson(req);
      return ok(res, { ok: true, reviewId: params.reviewId });
    }
  }

  // news
  if (req.method === 'GET' && pathname === '/news') {
    return ok(res, []);
  }

  // meal plans
  if (req.method === 'GET' && pathname === '/meal-plans') {
    return ok(res, [{ id: 'plan_001', dishes: ['dish_001'] }]);
  }
  if (req.method === 'POST' && pathname === '/meal-plans') {
    await readJson(req);
    return ok(res, { id: 'plan_new' });
  }

  // ai
  if (req.method === 'GET' && pathname === '/ai/suggestions') {
    return ok(res, ['想吃辣的', '来点清淡的']);
  }
  if (req.method === 'POST' && pathname === '/ai/recommend') {
    await readJson(req);
    return ok(res, [{ id: 'dish_001', name: '宫保鸡丁' }]);
  }
  if (req.method === 'POST' && pathname === '/ai/sessions') {
    await readJson(req);
    return ok(res, { id: 'session_001' });
  }
  {
    const params = match(pathname, '/ai/sessions/:sessionId/history');
    if (req.method === 'GET' && params) {
      return ok(res, [{ role: 'assistant', content: 'mock', sessionId: params.sessionId }]);
    }
  }

  // admin (minimal)
  if (req.method === 'GET' && pathname.startsWith('/admin/')) {
    return ok(res, []);
  }

  return notFound(res);
});

server.listen(PORT, () => {
  console.log(`[load-mock-api] listening on http://localhost:${PORT}`);
});
