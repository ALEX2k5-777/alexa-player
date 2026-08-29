#!/usr/bin/env python3
"""
Alexa Player - Local Web Server & High-Precision Audio API
Serves index.html, static assets, and provides /api/analyze for studio-grade Librosa music analysis.
"""

import os
import sys
import json
import tempfile
import http.server
import socketserver
from urllib.parse import parse_qs

PORT = 8000

class AlexaPlayerHandler(http.server.SimpleHTTPRequestHandler):

    def do_POST(self):
        if self.path == '/api/analyze':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length)

                # Save temporary file for librosa analysis
                with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as tmp:
                    tmp.write(body)
                    tmp_path = tmp.name

                # Run Python MIR audio analyzer
                import python_analyzer
                result = python_analyzer.analyze_song(tmp_path)

                try:
                    os.remove(tmp_path)
                except OSError:
                    pass

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
                return

            except Exception as e:
                print(f"Server analysis error: {e}", flush=True)
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                return

        return super().do_POST()

    def send_head(self):
        if 'Range' not in self.headers:
            return super().send_head()

        path = self.translate_path(self.path)
        f = None
        try:
            f = open(path, 'rb')
        except OSError:
            self.send_error(404, "File not found")
            return None

        fs = os.fstat(f.fileno())
        size = fs[6]

        range_header = self.headers.get('Range')
        try:
            range_type, bytes_range = range_header.split('=')
            start, end = bytes_range.split('-')
            start = int(start)
            end = int(end) if end else size - 1
        except ValueError:
            self.send_error(400, "Invalid Range Header")
            f.close()
            return None

        if start >= size:
            self.send_error(416, "Requested Range Not Satisfiable")
            f.close()
            return None

        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Last-Modified', self.date_time_string(fs.st_mtime))
        self.end_headers()
        f.seek(start)
        return f

def run_server():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    handler = AlexaPlayerHandler
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"==================================================", flush=True)
        print(f"  Alexa Player Web App Server Running")
        print(f"  Access UI at: http://localhost:{PORT}", flush=True)
        print(f"==================================================", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.", flush=True)
            httpd.server_close()

if __name__ == "__main__":
    run_server()
