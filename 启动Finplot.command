#!/bin/zsh
set -e
cd "$(dirname "$0")"

if [[ -n "${FINPLOT_DATABASE:-}" ]]; then
  export FINPLOT_DATABASE
fi

if [[ ! -d "data" ]]; then
  osascript -e 'display alert "Finplot 找不到 data 目录" message "请先将本机账单 SQLite 文件放入项目的 data 目录，或设置 FINPLOT_DATABASE。"'
  exit 1
fi

if ! python3 -c 'import sys; sys.path.insert(0, "app"); from ledger import resolve_database; resolve_database()' >/dev/null 2> /tmp/finplot-db-error; then
  selected=$(osascript <<'APPLESCRIPT'
tell application "Finder"
  activate
  set chosenFile to choose file with prompt "请选择 Finplot 使用的账单数据库"
  return POSIX path of chosenFile
end tell
APPLESCRIPT
  )
  if [[ -z "$selected" ]]; then
    exit 1
  fi
  print -rn -- "$selected" > .finplot-database
fi

python3 app/server.py &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT INT TERM
sleep 1
open "http://127.0.0.1:8765"
wait "$server_pid"
