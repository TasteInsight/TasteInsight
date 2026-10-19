import base64
import hashlib
import unittest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.responses import HTMLResponse, JSONResponse, Response
from prefix_adapter import PublicPathMiddleware


class PrefixAdapterTests(unittest.TestCase):
    def client(self, content, path='/page', json=False, media_type=None):
        app = FastAPI(root_path='/werss')
        app.add_middleware(PublicPathMiddleware)

        @app.get(path)
        async def page():
            return Response(content, media_type=media_type) if media_type else (JSONResponse(content) if json else HTMLResponse(content))

        return TestClient(app, root_path='/werss')

    def test_local_resources_and_pagination_use_the_deployment_path(self):
        html = '<a href="/views/mps">来源</a><img src="/files/logo.png"><form action="/views/articles"></form><button data-next-url="/views/mps?page=2">更多</button>'
        response = self.client(html).get('/page')
        self.assertEqual(response.status_code, 200)
        for path in ['/werss/views/mps', '/werss/files/logo.png', '/werss/views/articles', '/werss/views/mps?page=2']:
            self.assertIn(path, response.text)
        self.assertEqual(int(response.headers['content-length']), len(response.content))

    def test_external_urls_and_already_prefixed_urls_keep_their_meaning(self):
        html = '<a href="https://mp.weixin.qq.com/s/a">原文</a><img src="//example.com/a.png"><img src="/werss/assets/a.svg"><a href="#top">顶部</a>'
        response = self.client(html).get('/page')
        for value in ['https://mp.weixin.qq.com/s/a', '//example.com/a.png', '/werss/assets/a.svg', '#top']:
            self.assertIn(value, response.text)
        self.assertNotIn('/werss/werss/', response.text)

    def test_json_article_content_remains_a_data_payload(self):
        payload = {'content': '<img src="/example">', 'code': '/static/qr.png'}
        self.assertEqual(self.client(payload, json=True).get('/page').json(), payload)

    def test_uploaded_html_is_sandboxed_before_body_processing(self):
        html = '<script>document.body.dataset.compromised="yes"</script>'
        response = self.client(html, '/files/probe.html').get('/werss/files/probe.html')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.text, html)
        self.assertEqual(response.headers['content-security-policy'], "default-src 'none'; sandbox")
        self.assertEqual(response.headers['x-content-type-options'], 'nosniff')

    def test_upload_policy_does_not_apply_to_the_application_document(self):
        from pathlib import Path
        response = self.client(Path('/app/static/index.html').read_bytes()).get('/page')
        self.assertNotIn('sandbox', response.headers.get('content-security-policy', ''))

    def test_external_documents_are_isolated_independently_of_their_route(self):
        for path, media_type, content in [
            ('/rss/content/article-1', 'text/html', '<script>localStorage.getItem("admin_token")</script>'),
            ('/static/res/logo/remote.svg', 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'),
            ('/api/v1/wx/proxy/proxy', 'text/html', '<html><script src="https://example.com/app.js"></script></html>'),
        ]:
            with self.subTest(path=path):
                response = self.client(content, path, media_type=media_type).get('/werss'+path)
                self.assertEqual(response.status_code, 200)
                policy = response.headers.get('content-security-policy', '')
                self.assertIn('sandbox', policy)
                self.assertNotIn('allow-scripts', policy)
                self.assertNotIn('allow-same-origin', policy)
                self.assertEqual(response.headers['x-content-type-options'], 'nosniff')

    def test_builtin_api_documentation_keeps_its_trusted_renderer(self):
        app = FastAPI(root_path='/werss', docs_url='/api/docs', redoc_url='/api/redoc')
        app.add_middleware(PublicPathMiddleware)
        client = TestClient(app, root_path='/werss')
        for path in ['/api/docs', '/api/redoc']:
            with self.subTest(path=path):
                response = client.get('/werss'+path)
                self.assertEqual(response.status_code, 200)
                self.assertNotIn('sandbox', response.headers.get('content-security-policy', ''))
                self.assertEqual(response.headers['x-content-type-options'], 'nosniff')

    def test_reader_pages_allow_only_built_in_scripts(self):
        script = 'document.body.dataset.compromised="yes"'
        response = self.client('<script>'+script+'</script>', '/views/articles').get('/werss/views/articles', headers={'X-Forwarded-Host':'admin.example.test:8443','X-Forwarded-Proto':'https'})
        policy = response.headers['content-security-policy']
        self.assertIn('https://admin.example.test:8443/werss/assets/', policy)
        self.assertIn("frame-src 'none'", policy)
        digest = base64.b64encode(hashlib.sha256(script.encode()).digest()).decode()
        self.assertNotIn(digest, policy)
        self.assertNotIn("'unsafe-inline'", policy)
        self.assertNotIn('/files/', policy)


if __name__ == '__main__':
    unittest.main()
