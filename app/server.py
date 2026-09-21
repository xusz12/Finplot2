from __future__ import annotations

import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from ledger import category_totals, monthly_totals, period_totals, recent_transactions

ROOT = Path(__file__).resolve().parent


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/overview":
            query = parse_qs(parsed.query)
            month = query.get("month", ["2026-09"])[0]
            natures = tuple(query.get("nature", [])) or None
            period = query.get("period", ["month"])[0]
            year = month[:4]
            payload = {
                "month": month,
                "period": period,
                "totals": period_totals(year, natures=natures) if period == "year" else monthly_totals(month, natures=natures),
                "categories": category_totals(month, "支出", natures=natures)[:8],
                "recent": recent_transactions(month, limit=10),
            }
            body = json.dumps(payload, ensure_ascii=False).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/":
            self.path = "/index.html"
        return super().do_GET()


if __name__ == "__main__":
    port = 8765
    print(f"Finplot listening on http://0.0.0.0:{port}")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
