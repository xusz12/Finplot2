"""Read-only access to the Finplot ledger database.

The module deliberately returns integer cents for monetary aggregates.  The UI
can format those values as yuan at the final boundary without introducing
floating point accumulation errors.
"""

from __future__ import annotations

import sqlite3
import os
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATABASE_ENV = "FINPLOT_DATABASE"
DATABASE_CONFIG = PROJECT_ROOT / ".finplot-database"


def resolve_database(database: str | Path | None = None) -> Path:
    """Resolve a local ledger without embedding a machine-specific path.

    Priority: explicit argument, FINPLOT_DATABASE, then one SQLite file in
    the repository's data directory. Multiple candidates are rejected so a
    machine cannot silently display the wrong ledger.
    """
    if database:
        path = Path(database).expanduser()
    elif os.environ.get(DATABASE_ENV):
        path = Path(os.environ[DATABASE_ENV]).expanduser()
    elif DATABASE_CONFIG.is_file() and DATABASE_CONFIG.read_text().strip():
        path = Path(DATABASE_CONFIG.read_text().strip()).expanduser()
    else:
        candidates = sorted(
            path for pattern in ("*.sqlite3", "*.sqlite", "*.db")
            for path in (PROJECT_ROOT / "data").glob(pattern)
            if path.is_file()
        )
        if len(candidates) == 1:
            path = candidates[0]
        elif not candidates:
            raise FileNotFoundError(
                "未找到账单数据库。请将 SQLite 文件放入 data/，或设置 FINPLOT_DATABASE。"
            )
        else:
            names = ", ".join(str(item) for item in candidates)
            raise RuntimeError(
                f"找到多个账单数据库：{names}。请设置 FINPLOT_DATABASE 指定要使用的文件。"
            )
    path = path.resolve()
    if not path.is_file():
        raise FileNotFoundError(f"账单数据库不存在：{path}")
    return path


DEFAULT_DATABASE = PROJECT_ROOT / "data" / "ledger_2026-09-22.sqlite3"


@contextmanager
def connect(database: str | Path | None = None) -> Iterator[sqlite3.Connection]:
    """Open the database in SQLite read-only mode and close it reliably."""
    path = resolve_database(database)
    connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
    finally:
        connection.close()


def _nature_clause(natures: tuple[str, ...] | None) -> tuple[str, list[str]]:
    if not natures:
        return "", []
    placeholders = ",".join("?" for _ in natures)
    return f" AND c.nature IN ({placeholders})", list(natures)


def dataset_metadata(database: str | Path | None = None) -> dict[str, str]:
    with connect(database) as db:
        return {row["key"]: row["value"] for row in db.execute("SELECT key, value FROM metadata ORDER BY key")}


def transaction_count(database: str | Path | None = None) -> int:
    with connect(database) as db:
        return int(db.execute("SELECT COUNT(*) FROM transactions").fetchone()[0])


def date_range(database: str | Path | None = None) -> dict[str, str | None]:
    with connect(database) as db:
        row = db.execute("SELECT MIN(occurred_at) AS start, MAX(occurred_at) AS end FROM transactions").fetchone()
        return {"start": row["start"], "end": row["end"]}


def monthly_totals(
    month: str,
    *,
    database: str | Path | None = None,
    natures: tuple[str, ...] | None = None,
) -> dict[str, int]:
    """Return income, expense and balance in cents for YYYY-MM."""
    clause, args = _nature_clause(natures)
    with connect(database) as db:
        rows = db.execute(
            """SELECT t.direction, COALESCE(SUM(t.amount_cents), 0) AS cents
               FROM transactions t JOIN categories c ON c.id = t.category_id
               WHERE substr(t.occurred_at, 1, 7) = ?""" + clause + " GROUP BY t.direction",
            [month, *args],
        ).fetchall()
    totals = {"收入": 0, "支出": 0}
    totals.update({row["direction"]: int(row["cents"]) for row in rows})
    totals["结余"] = totals["收入"] - totals["支出"]
    return {"income_cents": totals["收入"], "expense_cents": totals["支出"], "balance_cents": totals["结余"]}


def period_totals(
    year: str,
    *,
    database: str | Path | None = None,
    natures: tuple[str, ...] | None = None,
) -> dict[str, int]:
    """Return totals for a calendar year, still aggregated in integer cents."""
    clause, args = _nature_clause(natures)
    with connect(database) as db:
        rows = db.execute(
            """SELECT t.direction, COALESCE(SUM(t.amount_cents), 0) AS cents
               FROM transactions t JOIN categories c ON c.id = t.category_id
               WHERE substr(t.occurred_at, 1, 4) = ?""" + clause + " GROUP BY t.direction",
            [year, *args],
        ).fetchall()
    totals = {"收入": 0, "支出": 0}
    totals.update({row["direction"]: int(row["cents"]) for row in rows})
    totals["结余"] = totals["收入"] - totals["支出"]
    return {"income_cents": totals["收入"], "expense_cents": totals["支出"], "balance_cents": totals["结余"]}


def category_totals(
    month: str,
    direction: str,
    *,
    database: str | Path | None = None,
    natures: tuple[str, ...] | None = None,
) -> list[dict[str, int | str]]:
    clause, args = _nature_clause(natures)
    with connect(database) as db:
        rows = db.execute(
            """SELECT c.name AS category, g.name AS category_group,
                      COUNT(*) AS transaction_count, SUM(t.amount_cents) AS amount_cents
               FROM transactions t
               JOIN categories c ON c.id = t.category_id
               JOIN category_groups g ON g.id = c.group_id
               WHERE substr(t.occurred_at, 1, 7) = ? AND t.direction = ?""" + clause +
            " GROUP BY c.id, c.name, g.name ORDER BY amount_cents DESC, c.sort_order",
            [month, direction, *args],
        ).fetchall()
    return [dict(row) for row in rows]


def recent_transactions(
    month: str | None = None,
    *,
    limit: int = 20,
    database: str | Path | None = None,
) -> list[dict]:
    if limit < 1 or limit > 200:
        raise ValueError("limit must be between 1 and 200")
    where = "WHERE substr(t.occurred_at, 1, 7) = ?" if month else ""
    args = [month] if month else []
    with connect(database) as db:
        rows = db.execute(
            """SELECT t.id, t.occurred_at, t.direction, t.amount_cents,
                      g.name AS category_group, c.name AS category, c.nature,
                      t.note, t.source_category, t.source_record_id
               FROM transactions t
               JOIN categories c ON c.id = t.category_id
               JOIN category_groups g ON g.id = c.group_id """ + where +
            " ORDER BY t.occurred_at DESC, t.id DESC LIMIT ?",
            [*args, limit],
        ).fetchall()
    return [dict(row) for row in rows]
