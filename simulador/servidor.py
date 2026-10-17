import http.server
import socketserver
import sys
import os
import webbrowser

RAIZ = os.path.dirname(os.path.abspath(__file__))
PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class Manejador(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=RAIZ, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, formato, *args):
        pass


class Servidor(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    with Servidor(('127.0.0.1', PUERTO), Manejador) as httpd:
        url = f'http://127.0.0.1:{PUERTO}/index.html'
        print(f'Simulador de estacion de bombeo: {url}')
        print('Ctrl+C para detener el servidor.')
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nServidor detenido.')