from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
from ledger import connect
ROOT = Path(__file__).resolve().parent
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/api/ledger':
            with connect() as db:
                rows = [dict(r) for r in db.execute('''SELECT t.id,t.occurred_at,t.direction,t.amount_cents,c.id category_id,c.name category,g.name category_group,c.nature,t.note FROM transactions t JOIN categories c ON c.id=t.category_id JOIN category_groups g ON g.id=c.group_id ORDER BY t.occurred_at DESC,t.id DESC''')]
            body=json.dumps(rows,ensure_ascii=False).encode(); mime='application/json'
        elif path in ('/', '/index.html','/app.js'):
            body=(ROOT / ('index.html' if path=='/' else path[1:])).read_bytes(); mime='application/javascript' if path.endswith('.js') else 'text/html'
        else:
            self.send_error(404); return
        self.send_response(200)
        self.send_header('Content-Type',mime+'; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers(); self.wfile.write(body)
if __name__=='__main__':
    ThreadingHTTPServer(('0.0.0.0',8765),Handler).serve_forever()
