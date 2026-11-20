"""Servidor SOMENTE de QA: aplica os cabeçalhos de vercel.json em localhost.
Não emula o pipeline da Vercel nem as exclusões de .vercelignore.
Uso: python3 tests/servidor-seguranca.py [porta]
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import sys

RAIZ = Path(__file__).resolve().parent.parent
CABECALHOS = json.loads((RAIZ / 'vercel.json').read_text())['headers'][0]['headers']

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        for item in CABECALHOS:
            self.send_header(item['key'], item['value'])
        super().end_headers()

if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 8766),
                        partial(Handler, directory=str(RAIZ))).serve_forever()
