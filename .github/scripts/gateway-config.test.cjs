const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const backend = path.resolve(__dirname, '../../backend');

function render(overrides = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tasteinsight-gateway-'));
  try {
    const result = spawnSync('/bin/sh', [path.join(backend, 'gateway-render.sh'), backend, directory], {
      env: {
        PATH: process.env.PATH,
        APP_URL: 'http://api.example.test:8080',
        ADMIN_APP_URL: 'http://admin.example.test:8080',
        GATEWAY_TLS_MODE: 'off',
        ...overrides,
      },
      encoding: 'utf8',
      timeout: 10000,
    });
    if (result.error) throw result.error;
    const read = (file) => fs.readFileSync(path.join(directory, file), 'utf8');
    return {
      ...result,
      files: result.status ? undefined : {
        main: read('conf.d/default.conf'),
        common: read('tasteinsight/nginx.common.conf'),
        public: read('tasteinsight/nginx.public.conf'),
        admin: read('tasteinsight/nginx.admin.conf'),
      },
    };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

for (const mode of ['http', 'tls', 'external-tls']) {
  test(`${mode} rendering keeps host routing independent and preserves Nginx variables`, () => {
    const scheme = mode === 'http' ? 'http' : 'https';
    const result = render({
      APP_URL: `${scheme}://API.other.test:9443/`,
      ADMIN_APP_URL: `${scheme}://manage.other.test:9443`,
      GATEWAY_TLS_MODE: mode === 'tls' ? 'on' : 'off',
      TLS_CERT_FILE: 'custom-fullchain.pem', TLS_KEY_FILE: 'custom.key',
    });
    assert.equal(result.status, 0, result.stderr);
    const { main, common, public: publicRoutes, admin } = result.files;
    assert.match(main, /server_name api\.other\.test;/);
    assert.match(main, /server_name manage\.other\.test;/);
    assert.match(main, /include \/etc\/nginx\/tasteinsight\/nginx\.common\.conf;/);
    assert.match(publicRoutes, /proxy_pass http:\/\/public_api\//);
    assert.doesNotMatch(publicRoutes, /proxy_pass http:\/\/(?:admin_api|admin_frontend)/);
    assert.match(admin, /proxy_pass http:\/\/admin_api\//);
    assert.match(admin, /proxy_pass http:\/\/admin_frontend;/);
    assert.doesNotMatch(admin, /proxy_pass http:\/\/public_api/);
    assert.match(publicRoutes, /proxy_set_header Host \$host;/);
    assert.match(common, /\$remote_addr/);
    assert.match(common, /\$proxy_add_x_forwarded_for/);
    assert.ok(publicRoutes.includes(`proxy_set_header X-Forwarded-Proto ${scheme};`));
    assert.ok(admin.includes(`proxy_set_header X-Forwarded-Proto ${scheme};`));
    for (const [realm, routes] of [['public', publicRoutes], ['admin', admin]]) {
      assert.match(routes,
        /location = \/api\/v1\s*\{\s*absolute_redirect off;\s*return 308 \/api\/v1\/;\s*\}/,
        `${realm} API prefix redirect must stay relative to the external origin`);
    }
    assert.doesNotMatch(publicRoutes, /manage\.other\.test|ADMIN_ORIGIN|ADMIN_HOST/);
    assert.match(publicRoutes, /location \/\s*\{\s*return 404;\s*\}/);
    assert.doesNotMatch(publicRoutes, /location = \/(?:login)?\s*\{/);
    assert.doesNotMatch(Object.values(result.files).join('\n'), /\$\{[A-Z_]+\}|tasteinsight\.cn/);
    if (mode === 'tls') {
      assert.match(main, /listen 443 ssl default_server;/);
      assert.match(main, /ssl_reject_handshake on;/);
      assert.match(main, /ssl_certificate \/etc\/nginx\/tls\/custom-fullchain\.pem;/);
      assert.match(main, /ssl_certificate_key \/etc\/nginx\/tls\/custom\.key;/);
      assert.ok(main.includes('https://API.other.test:9443$request_uri'));
    } else {
      assert.doesNotMatch(main, /listen 443|ssl_certificate/);
    }
  });
}

test('Docker DNS re-resolution and private health are shared across TLS modes', () => {
  for (const tls of [false, true]) {
    const scheme = tls ? 'https' : 'http';
    const result = render({
      APP_URL: `${scheme}://api.example.test`, ADMIN_APP_URL: `${scheme}://admin.example.test`,
      GATEWAY_TLS_MODE: tls ? 'on' : 'off',
    });
    assert.equal(result.status, 0, result.stderr);
    const { common, public: publicRoutes } = result.files;
    assert.match(common, /resolver 127\.0\.0\.11 valid=10s ipv6=off;/);
    for (const [upstream, service] of [['public_api', 'public-api:3000'], ['admin_api', 'admin-api:3000'], ['admin_frontend', 'frontend:80']]) {
      assert.ok(common.includes(`zone ${upstream} 64k;`));
      assert.ok(common.includes(`server ${service} resolve;`));
    }
    assert.match(common, /listen 80 default_server;\s*server_name _;\s*return 444;/);
    assert.match(common, /allow 127\.0\.0\.1;\s*allow ::1;\s*deny all;/);
    for (const target of ['public', 'admin', 'frontend']) assert.ok(common.includes(`location = /health/${target}`));
    assert.match(publicRoutes, /proxy_buffering off;/);
    assert.match(publicRoutes, /proxy_read_timeout 300s;/);
    assert.match(publicRoutes, /alias \/var\/www\/uploads\//);
  }
});

for (const origin of [
  '', 'ftp://api.example.test', 'http://user:secret@api.example.test',
  'https://api.example.test/path', 'https://api.example.test/?code=secret',
  'https://api.example.test#fragment', 'https://api.example.test;return 200',
  'https://api.example.test\nserver_name injected.test', 'https://*.example.test',
  'https://api..test', 'https://-api.test', 'https://api-.test',
  `https://${'a'.repeat(64)}.test`, 'https://api.test:0', 'https://api.test:65536',
  'https://api.test:abc', 'http://localhost', 'http://127.0.0.1',
]) {
  test(`gateway rejects invalid or reserved origin ${JSON.stringify(origin)}`, () => {
    const result = render({ APP_URL: origin });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Gateway configuration:/);
    if (origin) assert.ok(!result.stderr.includes(origin));
  });
}

test('same virtual host, invalid TLS mode and unsafe certificate filenames fail closed', () => {
  for (const override of [
    { ADMIN_APP_URL: 'https://API.example.test:9443' },
    { GATEWAY_TLS_MODE: 'auto' },
    { GATEWAY_TLS_MODE: 'on' },
    { TLS_CERT_FILE: '../outside.pem' },
    { TLS_KEY_FILE: 'key.pem; include bad.conf' },
  ]) {
    const result = render(override);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Gateway configuration:/);
  }
});
