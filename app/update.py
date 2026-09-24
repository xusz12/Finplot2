"""Tag-only updater. No database writes, hard resets, cleans or automatic merges."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
REMOTE = 'https://github.com/xusz12/Finplot2.git'
STATUS = ROOT / '.finplot-update-status.json'
TAG_RE = re.compile(r'^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$')
ACTIVE = {'running', 'restarting'}


def version_key(tag):
    match = TAG_RE.fullmatch(tag or '')
    return tuple(map(int, match.groups())) if match else None


def run(*args, timeout=60):
    env = dict(os.environ, GIT_TERMINAL_PROMPT='0', GIT_MERGE_AUTOEDIT='no')
    result = subprocess.run(args, cwd=ROOT, env=env, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError((result.stderr or result.stdout or '命令失败').strip()[-500:])
    return result.stdout.strip()


def git(*args):
    return run('git', *args)


def read_version():
    data = json.loads((ROOT / 'app/version.json').read_text())
    if version_key('v' + data['version']) is None:
        raise ValueError('本地版本号无效')
    return data


def github_tags():
    output = git('ls-remote', '--tags', REMOTE)
    tags = {}
    for line in output.splitlines():
        sha, ref = line.split()
        tag = ref.split('refs/tags/')[-1].removesuffix('^{}')
        if version_key(tag) is not None:
            if ref.endswith('^{}') or tag not in tags:
                tags[tag] = sha
    return tags


def check_update():
    tags = github_tags()
    latest = max(tags, key=version_key) if tags else None
    current = 'v' + read_version()['version']
    return dict(current=current, latest=latest, commit=tags.get(latest),
                available=bool(latest and version_key(latest) > version_key(current)),
                managed=bool(os.environ.get('FINPLOT_SUPERVISOR_PID')))


def write_status(state, message, **extra):
    payload = dict(state=state, message=message, pid=os.getpid(), updated_at=time.time(), **extra)
    tmp = STATUS.with_suffix('.tmp')
    tmp.write_text(json.dumps(payload, ensure_ascii=False))
    tmp.replace(STATUS)
    return payload


def update_status():
    try:
        data = json.loads(STATUS.read_text())
        if data.get('state') in ACTIVE:
            try:
                os.kill(data['pid'], 0)
                if time.time() - data['updated_at'] > 240:
                    raise ProcessLookupError()
            except (ProcessLookupError, KeyError):
                return dict(state='failed', message='上次更新中断，请检查本地 Git 状态后重试。')
        return data
    except (OSError, ValueError):
        return dict(state='idle', message='')


def clean():
    if git('status', '--porcelain', '--untracked-files=no'):
        raise RuntimeError('检测到本地代码修改，请先提交或另行保存后再更新；不会覆盖你的修改。')


def validate_target(commit, tag):
    data = json.loads(git('show', f'{commit}:app/version.json'))
    if 'v' + data['version'] != tag:
        raise RuntimeError('Tag 与版本文件不一致，已停止更新。')
    paths = git('diff', '--name-only', 'HEAD', commit).splitlines()
    target_paths = set(git('ls-tree', '-r', '--name-only', commit).splitlines())
    local_paths = set(git('ls-files', '--others', '--exclude-standard').splitlines())
    local_paths.update(git('ls-files', '--others', '--ignored', '--exclude-standard').splitlines())
    if target_paths & local_paths:
        raise RuntimeError('新版本与本地未跟踪文件冲突，已停止更新。')
    if any(p.startswith(('data/', '.finplot-', '.env')) or p.endswith(('.sqlite', '.sqlite3', '.db')) for p in paths):
        raise RuntimeError('发布版本包含受保护的本地数据路径，已停止更新。')
    # Compile in memory before touching the working tree. No pycache or ledger access.
    for path in ('app/server.py', 'app/ledger.py', 'app/update.py', 'app/supervisor.py'):
        compile(git('show', f'{commit}:{path}'), path, 'exec')


def healthy(commit, timeout=20):
    deadline = time.monotonic() + timeout
    port = os.environ.get('FINPLOT_PORT', '8765')
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    while time.monotonic() < deadline:
        try:
            with opener.open(f'http://127.0.0.1:{port}/api/health', timeout=1) as response:
                data = json.load(response)
            if data.get('commit') == commit and data.get('ok'):
                return True
        except (OSError, ValueError):
            pass
        time.sleep(.3)
    return False


def apply(tag, commit, supervisor_pid):
    old = None
    changed = False
    try:
        if version_key(tag) is None or not re.fullmatch(r'[a-f0-9]{40}', commit):
            raise RuntimeError('更新目标无效。')
        clean()
        if version_key(tag) <= version_key('v' + read_version()['version']):
            raise RuntimeError('目标版本不高于本地版本。')
        git('symbolic-ref', '--quiet', 'HEAD')  # Refuse detached checkouts.
        old = git('rev-parse', 'HEAD')
        write_status('running', '正在从 GitHub 下载已确认的版本……', version=tag)
        git('fetch', '--no-tags', REMOTE, f'refs/tags/{tag}')
        target = git('rev-parse', 'FETCH_HEAD^{commit}')
        if target != commit:
            raise RuntimeError('远端 Tag 已变化，请重新检查版本。')
        git('merge-base', '--is-ancestor', old, target)
        validate_target(target, tag)
        clean()
        git('merge', '--ff-only', target)
        changed = True
        write_status('restarting', '正在重启并验证新版本……', version=tag)
        os.kill(supervisor_pid, signal.SIGUSR1)
        if not healthy(target):
            raise RuntimeError('新版本未通过启动健康检查。')
        write_status('succeeded', f'已更新至 {tag}，服务运行正常。', version=tag)
    except Exception as exc:
        message = str(exc)
        if changed:
            try:
                clean()
                if git('rev-parse', 'HEAD') != commit:
                    raise RuntimeError('更新期间 HEAD 已被其他操作改变')
                # --keep refuses overlapping local edits; never use --hard or clean.
                git('reset', '--keep', old)
                os.kill(supervisor_pid, signal.SIGUSR1)
                message += ' 已恢复旧版本。' if healthy(old) else ' 已恢复旧代码，请手动重启服务。'
            except Exception as rollback:
                message += f' 自动恢复停止：{rollback}。请手动检查，未强制覆盖文件。'
        write_status('failed', message)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--tag', required=True)
    parser.add_argument('--commit', required=True)
    parser.add_argument('--supervisor-pid', required=True, type=int)
    args = parser.parse_args()
    with (ROOT / '.finplot-update.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        apply(args.tag, args.commit, args.supervisor_pid)


if __name__ == '__main__':
    main()
