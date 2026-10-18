"""Real Kuma + public gateway boundary and recovery drill, isolated Docker resources.
Run after: docker build -t tasteinsight-status-gateway:test ops/status
"""
import base64
import http.client
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
import uuid

ROOT = Path(__file__).parents[1]
PREFIX = 'ti-status-test-' + uuid.uuid4().hex[:10]
IMAGE = os.environ.get('STATUS_TEST_IMAGE', 'tasteinsight-status-gateway:test')
THEME = (ROOT / 'status/theme.css').read_text()
LOGO_BASE64 = base64.b64encode((ROOT.parent / 'frontend-web/src/assets/images/TasteInsight_Icon.png').read_bytes()).decode()


def run(*args, input=None):
    result = subprocess.run(args, input=input, capture_output=True, timeout=240)
    if result.returncode:
        raise RuntimeError(f'{args[:3]}: {result.stderr.decode()[-2000:]} {result.stdout.decode()[-2000:]}')
    return result.stdout


def wait_for(check, description, timeout=100):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            result = check()
            if result:
                return result
        except (OSError, http.client.HTTPException, json.JSONDecodeError):
            pass
        time.sleep(1)
    raise AssertionError('Timed out: ' + description)


def request(port, path, method='GET', headers=None):
    connection = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
    try:
        connection.request(method, path, headers=headers or {})
        response = connection.getresponse()
        return response.status, dict(response.getheaders()), response.read().decode()
    finally:
        connection.close()


def body(port, path):
    code, _, text = request(port, path)
    assert code == 200, (path, code, text[:100])
    return json.loads(text)


with tempfile.TemporaryDirectory(prefix=PREFIX) as temp:
    work = Path(temp)
    env = work / '.env'
    env.write_text('''BACKUP_DB_NAME=test
BACKUP_DB_USER=test
BACKUP_DB_PASSWORD=test
RESTIC_REPOSITORY=/test
RESTIC_PASSWORD=test
GRAFANA_ADMIN_PASSWORD=test
METRICS_DB_USER=test
METRICS_DB_PASSWORD=test
METRICS_REDIS_PASSWORD=test
APP_NETWORK=fixture-app
APP_DATABASE_NETWORK=fixture-db
APP_UPLOADS_VOLUME=fixture-uploads
STATUS_PUBLIC_ENABLED=false
STATUS_PAGE_SLUG=public
''')
    source = json.loads(run('docker', 'compose', '--env-file', str(env), '-f', str(ROOT / 'compose.yml'), 'config', '--format', 'json'))
    services = {name: source['services'][name] for name in ('status', 'uptime-kuma')}
    for service in services.values():
        service.pop('restart', None)
        for port in service['ports']:
            port['published'] = '0'
    services['status'].pop('build')
    services['status']['image'] = IMAGE
    services['fixture'] = {
        'image': 'python:3.12-alpine3.24', 'command': ['python', '/fixture.py'],
        'volumes': [str(ROOT / 'tests/kuma_fixture.py') + ':/fixture.py:ro'], 'networks': ['app'],
    }
    model = {'name': PREFIX, 'services': services, 'volumes': {'kuma-data': {}},
             'networks': {'app': {}, 'status-private': {'internal': True}, 'status-edge': {}}}
    file = work / 'compose.json'

    def write():
        file.write_text(json.dumps(model))

    def compose(*args, input=None):
        return run('docker', 'compose', '-f', str(file), *args, input=input)

    def container(service):
        return compose('ps', '-q', service).decode().strip()

    def port(service, target):
        return int(compose('port', service, str(target)).decode().strip().rsplit(':', 1)[1])

    def action(name, target=None):
        result = run('docker', 'exec', '-i', '-e', 'TEST_ACTION=' + name, '-e', 'TEST_CUSTOM_CSS=' + THEME, '-e', 'TEST_LOGO_BASE64=' + LOGO_BASE64,
                     target or container('uptime-kuma'), 'node', input=(ROOT / 'tests/kuma_fixture.cjs').read_bytes())
        return json.loads(result.decode().strip().splitlines()[-1])

    def ready():
        admin = port('uptime-kuma', 3001)
        return wait_for(lambda: request(admin, '/socket.io/?EIO=4&transport=polling')[0] == 200, 'Kuma ready')

    write()
    restored = PREFIX + '-restored'
    restored_volume = restored + '-data'
    try:
        compose('up', '-d')
        public = port('status', 8080)
        ready()
        for path in ('/', '/setup', '/socket.io/?EIO=4&transport=polling', '/api/status-page/public', '/assets/index.js'):
            assert request(public, path)[0] == 503, path
        print('PASS: public entry closed before private initialization', flush=True)

        seed = action('seed')
        model['services']['status']['environment']['STATUS_PUBLIC_ENABLED'] = 'true'
        write()
        compose('up', '-d', 'status')
        public = port('status', 8080)
        wait_for(lambda: request(public, '/')[0] == 302, 'gateway ready')
        assert request(public, '/')[1]['Location'] == '/status/public'
        page = request(public, '/status/public')
        assert page[0] == 200 and 'TasteInsight 服务状态' in page[2]
        assert page[1]['X-Frame-Options'] == 'DENY'
        assert "frame-ancestors 'none'" in page[1]['Content-Security-Policy']
        for asset in re.findall(r'(?:src|href)="(/assets/[^" ]+)"', page[2]):
            assert request(public, asset)[0] == 200, asset
        public_config = body(public, '/api/status-page/public')
        assert public_config['config']['customCSS'] == THEME
        assert public_config['publicGroupList'][0]['monitorList'] == [
            {'id': seed['group'], 'name': '菜品与食堂', 'sendUrl': 0, 'type': 'group'}]
        for hidden in ('private-probe-value', 'private-internal-health', 'private-database-monitor', 'private-page-title', 'fixture:8000'):
            assert hidden not in page[2] + json.dumps(public_config), hidden
        assert body(public, '/api/status-page/public/manifest.json')['start_url'] == '/status/public'
        rss = request(public, '/status/public/rss', headers={'Host': 'status.example.invalid', 'X-Forwarded-Proto': 'https'})[2]
        assert '服务维护' in rss
        assert 'https://status.example.invalid/status/public' in rss
        history = body(public, '/api/status-page/public/incident-history')
        assert history['incidents'][0]['title'] == '服务维护'
        assert action('resolve')['authenticated']
        resolved = body(public, '/api/status-page/public/incident-history?t=' + str(time.time_ns()))
        assert resolved['incidents'][0]['active'] is False
        assert request(public, '/status/public', 'HEAD')[0] == 200
        assert request(public, '/serviceWorker.js')[0] == 200
        print('PASS: page, assets, manifest, incident history, RSS and private monitor exclusion', flush=True)

        blocked = (
            '/dashboard', '/setup', '/setup-database', '/setup-database-info', '/manage-status-page', '/metrics',
            '/socket.io/', '/socket.io/?EIO=4&transport=polling', '/socket.io/?EIO=4&transport=websocket',
            '/api/push/guess', '/api/badge/1/status', '/api/status', '/status/private', '/status', '/status-page',
            '/api/status-page/private', '/api/status-page/heartbeat/private', '/api/status-page/private/incident-history',
            '/api/status-page/public/badge', '/api/status-page/public/../private',
            '/api/status-page/public%2f..%2fprivate', '/assets/../socket.io/', '/assets/%2e%2e/socket.io/',
            '/assets/%252e%252e%252fsocket.io/', '/%73ocket.io/', '//socket.io/',
            '/status/public/../../setup', '/api/status-page/public;private', '/upload/kuma.db', '/db-config.json',
        )
        for path in blocked:
            assert request(public, path)[0] == 404, path
        assert request(public, '/socket.io/?EIO=4&transport=websocket', headers={
            'Connection': 'Upgrade', 'Upgrade': 'websocket', 'Sec-WebSocket-Version': '13',
            'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ=='})[0] == 404
        for method in ('POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'):
            assert request(public, '/api/status-page/public', method)[0] == 405, method
        assert action('check')['authenticated']
        print(f'PASS: {len(blocked)} blocked paths, WebSocket upgrade and write methods; private login works', flush=True)

        def heartbeat():
            data = body(public, '/api/status-page/heartbeat/public?t=' + str(time.time_ns()))
            assert set(data['heartbeatList']) == {str(seed['group'])}
            beats = data['heartbeatList'][str(seed['group'])]
            assert all(beat['msg'] == '' for beat in beats)
            return beats

        wait_for(lambda: heartbeat() and heartbeat()[-1]['status'] == 1, 'healthy group')
        compose('exec', '-T', 'fixture', 'touch', '/tmp/down')
        wait_for(lambda: heartbeat()[-1]['status'] == 0, 'internal health failure reaches public group')
        compose('exec', '-T', 'fixture', 'rm', '/tmp/down')
        wait_for(lambda: heartbeat()[-1]['status'] == 1, 'public group recovers')
        assert any(beat['status'] == 0 for beat in heartbeat())
        print('PASS: real health failure and recovery, with public heartbeat history', flush=True)

        # Recreate the service with the same volume and let gateway DNS resolve it again.
        compose('up', '-d', '--force-recreate', 'uptime-kuma')
        ready()
        wait_for(lambda: request(public, '/api/status-page/public')[0] == 200, 'gateway resolves recreated Kuma')
        assert action('check')['authenticated']
        assert body(public, '/api/status-page/public/incident-history')['incidents'][0]['title'] == '服务维护'
        print('PASS: persistent account, settings and incidents after container recreation', flush=True)

        saved_beats = {(b['time'], b['status']) for b in heartbeat()}
        compose('stop', 'uptime-kuma')
        wait_for(lambda: request(public, '/status/public')[0] == 503, 'upstream failure is unavailable')
        archive = compose('run', '--rm', '-T', '--no-deps', '--entrypoint', 'tar', 'uptime-kuma', '-C', '/app/data', '-czf', '-', '.')
        run('docker', 'volume', 'create', '--label', 'tasteinsight.test=' + PREFIX, restored_volume)
        restore_args = ('docker', 'run', '--rm', '-i', '--network', 'none', '--user', '1000:1000',
                        '-v', restored_volume + ':/app/data', '--entrypoint', 'sh', services['uptime-kuma']['image'],
                        '-c', 'test -z "$(ls -A /app/data)" && exec tar -C /app/data -xzf -')
        run(*restore_args, input=archive)
        rejected = subprocess.run(restore_args, input=archive, capture_output=True, timeout=60)
        assert rejected.returncode != 0, 'restore must refuse nonempty volume'
        run('docker', 'run', '-d', '--name', restored, '--label', 'tasteinsight.test=' + PREFIX,
            '--network', 'none', '--user', '1000:1000', '-e', 'UPTIME_KUMA_DB_TYPE=sqlite',
            '-v', restored_volume + ':/app/data', services['uptime-kuma']['image'])
        wait_for(lambda: json.loads(run('docker', 'inspect', restored))[0]['State']['Health']['Status'] == 'healthy', 'restored Kuma ready')
        assert action('check', restored)['logoRestored']
        restored_beats = json.loads(run('docker', 'exec', restored, 'node', '-e',
            "fetch('http://127.0.0.1:3001/api/status-page/heartbeat/public').then(r=>r.json()).then(j=>console.log(JSON.stringify(j)))"))['heartbeatList'][str(seed['group'])]
        assert saved_beats <= {(b['time'], b['status']) for b in restored_beats}
        restored_history = run('docker', 'exec', restored, 'node', '-e',
            "fetch('http://127.0.0.1:3001/api/status-page/public/incident-history').then(r=>r.json()).then(j=>console.log(JSON.stringify(j)))")
        assert json.loads(restored_history)['incidents'][0]['title'] == '服务维护'
        print('PASS: stopped-volume export and isolated restore, account, heartbeat history, incidents and uploaded logo preserved; nonempty restore refused', flush=True)

        model['services']['status']['environment']['STATUS_PUBLIC_ENABLED'] = 'false'
        write()
        compose('up', '-d', 'status')
        public = port('status', 8080)
        wait_for(lambda: request(public, '/api/status-page/public')[0] == 503, 'unpublish closes API')
        print('PASS: publication can be revoked independently of Kuma', flush=True)
    except Exception:
        print(compose('logs', '--tail', '20').decode())
        raise
    finally:
        subprocess.run(['docker', 'rm', '-f', restored], capture_output=True)
        subprocess.run(['docker', 'volume', 'rm', restored_volume], capture_output=True)
        compose('down', '-v', '--remove-orphans')
