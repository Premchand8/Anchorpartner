"""Log UI events from the catalogue for agent monitoring."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_PATH = os.path.join(ROOT, 'ui-events.log')


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        if self.path != '/__pmj-ui-log':
            self.send_error(404)
            return
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8', errors='replace')
        try:
            entry = json.loads(body)
        except json.JSONDecodeError:
            entry = {'raw': body}
        entry['_received'] = datetime.now().isoformat(timespec='seconds')
        with open(LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
        self.send_response(204)
        self.end_headers()

    def log_message(self, format, *args):
        if args and isinstance(args[0], str) and '/__pmj-ui-log' in args[0]:
            return
        super().log_message(format, *args)


if __name__ == '__main__':
    if os.path.exists(LOG_PATH):
        os.remove(LOG_PATH)
    port = int(os.environ.get('PORT', '8080'))
    server = ThreadingHTTPServer(('0.0.0.0', port), Handler)
    print(f'PMJ catalogue + UI log server: http://localhost:{port}')
    print(f'UI events -> {LOG_PATH}')
    server.serve_forever()
