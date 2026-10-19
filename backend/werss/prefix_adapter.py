"""Mount WeRSS server-rendered pages below its public deployment path."""
import os
import base64
import hashlib
from pathlib import Path
from bs4 import BeautifulSoup
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


# Only scripts from the immutable reader templates receive inline execution permission.
TRUSTED_INLINE_SCRIPTS = {
    "'sha256-" + base64.b64encode(hashlib.sha256(str(script.string).encode()).digest()).decode() + "'"
    for template in Path('/app/public/templates').rglob('*.html')
    for script in BeautifulSoup(template.read_text(), 'html.parser').find_all('script')
    if script.string and not script.get('src')
}


# The built application shell is immutable; cached articles and remote documents share no such trust.
SPA_DOCUMENT = Path('/app/static/index.html').read_bytes()
UNTRUSTED_DOCUMENT_POLICY = "sandbox; object-src 'none'; base-uri 'none'"


class PublicPathMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        prefix = request.app.root_path
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Content-Security-Policy'] = UNTRUSTED_DOCUMENT_POLICY
        path = request.scope['path']
        resource_path = path[len(prefix):] if prefix and path.startswith(prefix + '/') else path
        if resource_path == '/files' or resource_path.startswith('/files/'):
            response.headers['Content-Security-Policy'] = "default-src 'none'; sandbox"
            return response
        if not prefix or not response.headers.get("content-type", "").startswith("text/html"):
            return response
        body = b"".join([chunk async for chunk in response.body_iterator])
        page = BeautifulSoup(body, "html.parser")
        for tag in page.find_all(True):
            for attribute in ("href", "src", "action", "poster", "data-next-url"):
                value = tag.get(attribute)
                if isinstance(value, str) and value.startswith("/") and not value.startswith(("//", prefix + "/")) and value != prefix:
                    tag[attribute] = prefix + value
        headers = dict(response.headers)
        headers.pop("content-length", None)
        endpoint = request.scope.get('endpoint')
        if body == SPA_DOCUMENT or getattr(endpoint, '__module__', '') == 'fastapi.applications':
            headers['content-security-policy'] = "object-src 'none'; base-uri 'self'"
        elif request.url.path.startswith(prefix + '/views/'):
            scheme = request.headers.get('x-forwarded-proto', request.url.scheme)
            host = request.headers.get('x-forwarded-host', request.headers.get('host', ''))
            origin = f'{scheme}://{host}'
            hashes = ' '.join(sorted(TRUSTED_INLINE_SCRIPTS))
            headers['content-security-policy'] = (
                f"script-src {origin}{prefix}/assets/ {origin}{prefix}/static/js/ {hashes}; "
                "object-src 'none'; base-uri 'none'; frame-src 'none'"
            )
        return Response(str(page), status_code=response.status_code, headers=headers, background=response.background)


def configure(app):
    app.root_path = os.environ.get("WERSS_PUBLIC_PATH", "/werss/").rstrip("/")
    app.add_middleware(PublicPathMiddleware)
