#!/usr/bin/env python3
"""
Serve the site with custom 404 page. Usage (from this directory):

  python3 serve.py [port]

e.g. python3 serve.py 8000  →  http://localhost:8000
"""

import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class Handler(SimpleHTTPRequestHandler):
    def send_error(self, code, message=None):
        if code == 404 and os.path.isfile("404.html"):
            self.error_message_format = ""
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            with open("404.html", "rb") as f:
                self.wfile.write(f.read())
        else:
            super().send_error(code, message)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = HTTPServer(("", port), Handler)
    print("Serving at http://localhost:{}/ (404 -> 404.html)".format(port))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
