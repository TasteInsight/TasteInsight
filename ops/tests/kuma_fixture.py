from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        down = Path('/tmp/down').exists() and self.path.startswith('/health')
        self.send_response(503 if down else 200)
        self.end_headers()
        self.wfile.write(b'{"status":"down"}' if down else b'{"status":"ok"}')
    def log_message(self, *args): pass
HTTPServer(('0.0.0.0', 8000), Handler).serve_forever()
