from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
import subprocess
import sys
from ledger import connect

from threading import Lock
from urllib.parse import urlsplit
from update import (ROOT as PROJECT_ROOT, read_version, version_key, check_update,
                    update_status, write_status, ACTIVE, clean, git)
ROOT = PROJECT_ROOT / 'app'
APPLY_LOCK = Lock()
try:
    RUNNING_COMMIT = git('rev-parse', 'HEAD')
except Exception:
    RUNNING_COMMIT = None
RUNNING_VERSION = read_version()


class Handler(BaseHTTPRequestHandler):
    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        try:
            if path == "/api/ledger":
                with connect() as db:
                    rows = [dict(r) for r in db.execute('''SELECT t.id,t.occurred_at,t.direction,t.amount_cents,c.id category_id,c.name category,g.name category_group,c.nature,t.note FROM transactions t JOIN categories c ON c.id=t.category_id JOIN category_groups g ON g.id=c.group_id ORDER BY t.occurred_at DESC,t.id DESC''')]
                self.send_json(rows); return
            if path == "/api/version":
                self.send_json(RUNNING_VERSION); return
            if path == "/api/update/status":
                self.send_json(update_status()); return
            if path == "/api/health":
                (ROOT / "index.html").read_bytes()
                (ROOT / "app.js").read_bytes()
                with connect() as db:
                    db.execute('SELECT id FROM transactions LIMIT 1').fetchone()
                self.send_json(dict(ok=True, commit=RUNNING_COMMIT)); return
            if path == "/api/update/check":
                self.send_json(check_update()); return
            if path in ("/", "/index.html", "/app.js"):
                file = ROOT / ("index.html" if path == "/" else path[1:])
                body = file.read_bytes()
                mime = "application/javascript" if path.endswith(".js") else "text/html"
                self.send_response(200); self.send_header("Content-Type", mime + "; charset=utf-8"); self.send_header("Cache-Control", "no-store"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body); return
            self.send_error(404)
        except subprocess.TimeoutExpired:
            self.send_json({"error": "连接 GitHub 超时。"}, 504)
        except Exception as exc:
            self.send_json({"error": str(exc)}, 502)

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path != "/api/update/apply":
            self.send_error(404); return
        # No login yet. Require a same-origin JSON request, never a form submission.
        origin = self.headers.get('Origin')
        if (self.headers.get('Content-Type') != 'application/json'
                or self.headers.get('X-Finplot-Update') != '1'
                or (origin and urlsplit(origin).netloc != self.headers.get('Host'))
                or self.headers.get('Sec-Fetch-Site') == 'cross-site'):
            self.send_json({'message': '更新请求来源无效。'}, 403); return
        if not APPLY_LOCK.acquire(blocking=False):
            self.send_json({'message': '更新正在进行，请勿重复提交。'}, 409); return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 1024:
                raise ValueError('更新请求长度无效。')
            payload = json.loads(self.rfile.read(length))
            if update_status().get('state') in ACTIVE:
                self.send_json({'message': '更新正在进行。'}, 409); return
            supervisor_pid = os.environ.get('FINPLOT_SUPERVISOR_PID')
            if not supervisor_pid:
                self.send_json({'message': '请先通过启动Finplot.command重新启动服务，再使用自动更新。'}, 409); return
            os.kill(int(supervisor_pid), 0)
            clean()
            checked = check_update()
            if not checked['available'] or (payload.get('tag'), payload.get('commit')) != (checked['latest'], checked['commit']):
                self.send_json({'message': '版本状态已变化，请重新检查更新。'}, 409); return
            write_status('running', '正在启动更新……', version=checked['latest'])
            try:
                subprocess.Popen([sys.executable, str(ROOT / 'update.py'), '--tag', checked['latest'],
                                  '--commit', checked['commit'], '--supervisor-pid', supervisor_pid],
                                 cwd=PROJECT_ROOT, start_new_session=True,
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception:
                write_status('failed', '无法启动更新进程。')
                raise
            self.send_json({'state': 'running', 'message': '更新已开始。'}, 202)
        except Exception as exc:
            self.send_json({'message': str(exc)}, 400)
        finally:
            APPLY_LOCK.release()

    def log_message(self, *_args):
        return


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("FINPLOT_PORT", "8765"))), Handler).serve_forever()
