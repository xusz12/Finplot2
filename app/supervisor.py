"""Small local supervisor; restarts only on an explicit update request."""
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
restart_requested = False
stopping = False


def handle(signum, _frame):
    global restart_requested, stopping
    if signum == signal.SIGUSR1:
        restart_requested = True
    else:
        stopping = True


def stop(child):
    if child.poll() is None:
        child.terminate()
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait()


def main():
    global restart_requested
    import fcntl
    lock = (ROOT / '.finplot-supervisor.lock').open('w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print('Finplot 已在此目录运行。', file=sys.stderr)
        return 1
    for sig in (signal.SIGUSR1, signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, handle)
    env = dict(os.environ, FINPLOT_SUPERVISOR_PID=str(os.getpid()))
    child = None
    try:
        while not stopping:
            restart_requested = False
            child = subprocess.Popen([sys.executable, str(ROOT / 'app/server.py')], cwd=ROOT, env=env)
            while not stopping and not restart_requested:
                if child.poll() is not None:
                    # During an update the updater may need to roll back and restart.
                    from update import update_status, ACTIVE
                    if update_status().get('state') not in ACTIVE:
                        return child.returncode
                time.sleep(.2)
            stop(child)
        return 0
    finally:
        if child is not None:
            stop(child)
        lock.close()


if __name__ == '__main__':
    raise SystemExit(main())
