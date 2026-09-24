"""Isolated Git and service tests; never fetch or modify the user's repository."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SOURCE / 'app'))
import update


class UpdateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        self.remote = base / 'remote'
        self.local = base / 'local'
        self.remote.mkdir()
        shutil.copytree(SOURCE / 'app', self.remote / 'app', ignore=shutil.ignore_patterns('__pycache__'))
        # Pin the synthetic old version independently of the application's release.
        (self.remote / 'app/version.json').write_text('{"version":"0.1.7","channel":"stable"}')
        shutil.copy(SOURCE / '.gitignore', self.remote)
        self.cmd(self.remote, 'init', '-b', 'main')
        self.cmd(self.remote, 'config', 'user.email', 'test@example.invalid')
        self.cmd(self.remote, 'config', 'user.name', '测试')
        self.commit('测试: 建立旧版本')
        self.old = self.cmd(self.remote, 'rev-parse', 'HEAD')
        self.cmd(base, 'clone', str(self.remote), str(self.local))
        self.patches = [patch.object(update, 'ROOT', self.local),
                        patch.object(update, 'REMOTE', str(self.remote)),
                        patch.object(update, 'STATUS', self.local / '.finplot-update-status.json')]
        for p in self.patches: p.start()

    def tearDown(self):
        for p in self.patches: p.stop()
        self.tmp.cleanup()

    def cmd(self, cwd, *args):
        return subprocess.check_output(['git', *args], cwd=cwd, stderr=subprocess.DEVNULL, text=True).strip()

    def commit(self, message):
        self.cmd(self.remote, 'add', '.')
        self.cmd(self.remote, 'commit', '-m', message)

    def release(self, broken=False, annotated=True):
        (self.remote / 'app/version.json').write_text('{"version":"0.1.8","channel":"stable"}')
        if broken:
            with (self.remote / 'app/server.py').open('a') as f: f.write('\nthis is invalid python!\n')
        self.commit('测试: 发布新版本')
        self.cmd(self.remote, 'tag', *(['-a', 'v0.1.8', '-m', '测试版本'] if annotated else ['v0.1.8']))
        return self.cmd(self.remote, 'rev-parse', 'HEAD')

    def test_versions_and_tags(self):
        self.assertGreater(update.version_key('v0.1.10'), update.version_key('v0.1.9'))
        self.assertIsNone(update.version_key('v0.1.8-beta'))
        sha = self.release()
        self.assertEqual(update.github_tags()['v0.1.8'], sha)
        self.assertTrue(update.check_update()['available'])

    def test_dirty_refuses(self):
        sha = self.release()
        with (self.local / 'app/app.js').open('a') as f: f.write('// local')
        update.apply('v0.1.8', sha, 123)
        self.assertEqual(update.update_status()['state'], 'failed')
        self.assertEqual(self.cmd(self.local, 'rev-parse', 'HEAD'), self.old)

    def test_invalid_python_refuses_before_merge(self):
        sha = self.release(broken=True)
        update.apply('v0.1.8', sha, 123)
        self.assertEqual(update.update_status()['state'], 'failed')
        self.assertEqual(self.cmd(self.local, 'rev-parse', 'HEAD'), self.old)

    def test_fast_forward_and_preserve_private_files(self):
        sha = self.release(annotated=False)
        (self.local / 'data').mkdir()
        private = self.local / 'data/private.sqlite3'
        private.write_bytes(b'private sentinel')
        (self.local / '.finplot-database').write_text(str(private))
        with patch.object(update.os, 'kill'), patch.object(update, 'healthy', return_value=True):
            update.apply('v0.1.8', sha, 123)
        self.assertEqual(update.update_status()['state'], 'succeeded')
        self.assertEqual(self.cmd(self.local, 'rev-parse', 'HEAD'), sha)
        self.assertEqual(private.read_bytes(), b'private sentinel')

    def test_health_failure_rolls_back(self):
        sha = self.release()
        with patch.object(update.os, 'kill'), patch.object(update, 'healthy', side_effect=[False, True]):
            update.apply('v0.1.8', sha, 123)
        self.assertEqual(self.cmd(self.local, 'rev-parse', 'HEAD'), self.old)
        self.assertIn('已恢复旧版本', update.update_status()['message'])

    def test_divergent_history_refuses(self):
        sha = self.release()
        self.cmd(self.local, 'config', 'user.email', 'test@example.invalid')
        self.cmd(self.local, 'config', 'user.name', '测试')
        (self.local / 'local.txt').write_text('local')
        self.cmd(self.local, 'add', '.')
        self.cmd(self.local, 'commit', '-m', '测试: 本地分叉')
        old = self.cmd(self.local, 'rev-parse', 'HEAD')
        update.apply('v0.1.8', sha, 123)
        self.assertEqual(self.cmd(self.local, 'rev-parse', 'HEAD'), old)
        self.assertEqual(update.update_status()['state'], 'failed')

    def test_moved_tag_refuses(self):
        sha = self.release()
        update.apply('v0.1.8', 'f' * 40, 123)
        self.assertIn('Tag 已变化', update.update_status()['message'])
        self.assertEqual(self.cmd(self.local, 'rev-parse', 'HEAD'), self.old)

    def test_untracked_conflict_refuses(self):
        (self.remote / 'new.txt').write_text('release')
        sha = self.release()
        (self.local / 'new.txt').write_text('personal')
        update.apply('v0.1.8', sha, 123)
        self.assertEqual((self.local / 'new.txt').read_text(), 'personal')
        self.assertEqual(self.cmd(self.local, 'rev-parse', 'HEAD'), self.old)
        self.assertEqual(update.update_status()['state'], 'failed')

    def test_protected_path_refuses(self):
        (self.remote / 'data').mkdir()
        (self.remote / 'data/private.db').write_text('must not deploy')
        self.cmd(self.remote, 'add', '-f', 'data/private.db')
        sha = self.release()
        update.apply('v0.1.8', sha, 123)
        self.assertIn('受保护', update.update_status()['message'])
        self.assertEqual(self.cmd(self.local, 'rev-parse', 'HEAD'), self.old)

    def test_api_guards_and_duplicate_submission(self):
        import http.client
        from http.server import ThreadingHTTPServer
        import threading
        import server
        httpd = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        conn = http.client.HTTPConnection('127.0.0.1', httpd.server_port)
        target = dict(available=True, latest='v0.1.8', commit='a' * 40)
        payload = json.dumps(dict(tag=target['latest'], commit=target['commit']))
        headers = {'Content-Type': 'application/json', 'X-Finplot-Update': '1'}
        def post(h):
            conn.request('POST', '/api/update/apply', payload, h)
            response = conn.getresponse()
            response.read()
            return response.status
        try:
            with patch.object(server, 'check_update', return_value=target), patch.object(server, 'clean'), patch.object(server.subprocess, 'Popen') as spawn:
                self.assertEqual(post({}), 403)
                self.assertEqual(post(dict(headers, Origin='https://evil.invalid')), 403)
                with patch.dict(os.environ, {'FINPLOT_SUPERVISOR_PID': ''}):
                    self.assertEqual(post(headers), 409)
                with patch.dict(os.environ, {'FINPLOT_SUPERVISOR_PID': str(os.getpid())}):
                    self.assertEqual(post(headers), 202)
                    self.assertEqual(post(headers), 409)
                self.assertEqual(spawn.call_count, 1)
        finally:
            conn.close(); httpd.shutdown(); httpd.server_close(); thread.join()

    def test_real_restart_and_shutdown(self):
        sha = self.release()
        db = self.local / 'test.sqlite3'
        with sqlite3.connect(db) as conn: conn.execute('CREATE TABLE transactions(id INTEGER)')
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0)); port = str(sock.getsockname()[1])
        env = dict(os.environ, FINPLOT_PORT=port, FINPLOT_DATABASE=str(db))
        proc = subprocess.Popen([sys.executable, 'app/supervisor.py'], cwd=self.local, env=env,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            with patch.dict(os.environ, {'FINPLOT_PORT': port}):
                self.assertTrue(update.healthy(self.old, 10))
                update.apply('v0.1.8', sha, proc.pid)
                self.assertEqual(update.update_status()['state'], 'succeeded')
                self.assertTrue(update.healthy(sha, 5))
        finally:
            proc.terminate(); proc.wait(timeout=8)
        with socket.socket() as sock:
            self.assertNotEqual(sock.connect_ex(('127.0.0.1', int(port))), 0)


if __name__ == '__main__':
    unittest.main()
