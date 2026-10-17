"""Read-only public projection of a fixed, private monitoring query."""
import json
import os
from pathlib import Path
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlencode, urlsplit
from urllib.request import urlopen

SERVICES = (("catalog", "菜品与食堂"), ("community", "校园社区"), ("admin", "管理服务"))
QUERY = 'probe_success{job=~"public-probes|internal-health"} and (time() - timestamp(probe_success{job=~"public-probes|internal-health"}) < 90)'


def project(rows, now):
    result = []
    for key, name in SERVICES:
        dependencies = (("public-probes", key), ("internal-health", "admin-api" if key == "admin" else "public-api"))
        states = []
        for job, service in dependencies:
            samples = [row.get("value", []) for row in rows if row.get("metric", {}).get("service") == service and row.get("metric", {}).get("job") == job]
            state = "unknown"
            if len(samples) == 1 and len(samples[0]) == 2:
                timestamp, value = samples[0]
                if 0 <= now - float(timestamp) <= 90:
                    state = {"1": "operational", "0": "disrupted"}.get(str(value), "unknown")
            states.append(state)
        state = "disrupted" if "disrupted" in states else "unknown" if "unknown" in states else "operational"
        result.append({"id": key, "name": name, "status": state})
    return result


class Monitor:
    def __init__(self):
        self.data = {"updatedAt": None, "services": project([], time.time())}
        self.lock = threading.Lock()

    def update(self):
        while True:
            try:
                endpoint = os.environ.get("PROMETHEUS_URL", "http://prometheus:9090").rstrip("/")
                with urlopen(endpoint + "/api/v1/query?" + urlencode({"query": QUERY}), timeout=5) as response:
                    payload = json.load(response)
                if payload.get("status") != "success" or payload["data"]["resultType"] != "vector":
                    raise ValueError("Unexpected monitoring response")
                data = {"updatedAt": int(time.time()), "services": project(payload["data"]["result"], time.time())}
            except Exception:
                data = {"updatedAt": None, "services": project([], time.time())}
            with self.lock:
                self.data = data
            time.sleep(20)

    def snapshot(self):
        with self.lock:
            data = dict(self.data)
        if data["updatedAt"] and time.time() - data["updatedAt"] > 90:
            data = {"updatedAt": None, "services": project([], time.time())}
        data["notice"] = os.environ.get("STATUS_NOTICE", "")
        return data


def handler(monitor):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            path = urlsplit(self.path).path
            if path == "/api/status":
                body = json.dumps(monitor.snapshot(), ensure_ascii=False).encode()
                content = "application/json; charset=utf-8"
            elif path in ("/", "/app.js", "/style.css"):
                name = {"/": "index.html", "/app.js": "app.js", "/style.css": "style.css"}[path]
                body = (Path(__file__).parent / name).read_bytes()
                content = {"/": "text/html; charset=utf-8", "/app.js": "text/javascript; charset=utf-8", "/style.css": "text/css; charset=utf-8"}[path]
            elif path == "/health":
                body, content = b"ok", "text/plain"
            else:
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header("Content-Type", content)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'")
            self.end_headers()
            self.wfile.write(body)
        def log_message(self, *args):
            pass
    return Handler


if __name__ == "__main__":
    monitor = Monitor()
    threading.Thread(target=monitor.update, daemon=True).start()
    ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "8080"))), handler(monitor)).serve_forever()
