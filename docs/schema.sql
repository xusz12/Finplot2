CREATE INDEX idx_transaction_tags_tag_id
    ON transaction_tags(tag_id, transaction_id);

CREATE INDEX idx_transactions_category_id
    ON transactions(category_id);

CREATE INDEX idx_transactions_direction_occurred_at
    ON transactions(direction, occurred_at);

CREATE INDEX idx_transactions_occurred_at
    ON transactions(occurred_at);

CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    group_id INTEGER NOT NULL REFERENCES category_groups(id),
    name TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('支出', '收入')),
    nature TEXT NOT NULL DEFAULT '日常'
        CHECK (nature IN ('日常', '投资', '往来', '调整')),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    sort_order INTEGER NOT NULL,
    UNIQUE (direction, name)
);

CREATE TABLE category_aliases (
    direction TEXT NOT NULL CHECK (direction IN ('支出', '收入')),
    alias TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    PRIMARY KEY (direction, alias)
);

CREATE TABLE category_groups (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('支出', '收入')),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    sort_order INTEGER NOT NULL,
    UNIQUE (direction, name)
);

CREATE TABLE import_batches (
    id INTEGER PRIMARY KEY,
    source_filename TEXT NOT NULL,
    source_sha256 TEXT NOT NULL UNIQUE,
    imported_at TEXT NOT NULL DEFAULT (datetime('now')),
    row_count INTEGER NOT NULL CHECK (row_count >= 0)
);

CREATE TABLE metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE tags (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE transaction_tags (
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id),
    source TEXT NOT NULL DEFAULT 'manual'
        CHECK (source IN ('manual', 'import_rule', 'inferred')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (transaction_id, tag_id)
);

CREATE TABLE transactions (
    id INTEGER PRIMARY KEY,
    occurred_at TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('支出', '收入')),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    category_id INTEGER NOT NULL REFERENCES categories(id),
    note TEXT,
    source_category TEXT,
    source_record_id TEXT UNIQUE,
    import_batch_id INTEGER REFERENCES import_batches(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER trg_category_direction_insert
BEFORE INSERT ON categories
WHEN NEW.direction != (SELECT direction FROM category_groups WHERE id = NEW.group_id)
BEGIN
    SELECT RAISE(ABORT, 'category direction does not match group');
END;

CREATE TRIGGER trg_category_direction_update
BEFORE UPDATE OF direction, group_id ON categories
WHEN NEW.direction != (SELECT direction FROM category_groups WHERE id = NEW.group_id)
BEGIN
    SELECT RAISE(ABORT, 'category direction does not match group');
END;

CREATE TRIGGER trg_transaction_direction_insert
BEFORE INSERT ON transactions
WHEN NEW.direction != (SELECT direction FROM categories WHERE id = NEW.category_id)
BEGIN
    SELECT RAISE(ABORT, 'transaction direction does not match category');
END;

CREATE TRIGGER trg_transaction_direction_update
BEFORE UPDATE OF direction, category_id ON transactions
WHEN NEW.direction != (SELECT direction FROM categories WHERE id = NEW.category_id)
BEGIN
    SELECT RAISE(ABORT, 'transaction direction does not match category');
END;

CREATE VIEW v_monthly_summary AS
SELECT
    substr(t.occurred_at, 1, 7) AS month,
    t.direction,
    c.nature,
    g.name AS category_group,
    c.name AS category,
    COUNT(*) AS transaction_count,
    SUM(t.amount_cents) / 100.0 AS amount_yuan
FROM transactions AS t
JOIN categories AS c ON c.id = t.category_id
JOIN category_groups AS g ON g.id = c.group_id
GROUP BY month, t.direction, c.nature, g.name, c.name;

CREATE VIEW v_transaction_tags AS
SELECT
    t.id AS transaction_id,
    t.occurred_at,
    t.direction,
    t.amount_cents / 100.0 AS amount_yuan,
    tag.name AS tag,
    tt.source AS tag_source,
    t.note
FROM transaction_tags AS tt
JOIN transactions AS t ON t.id = tt.transaction_id
JOIN tags AS tag ON tag.id = tt.tag_id;

CREATE VIEW v_transactions AS
SELECT
    t.id,
    t.occurred_at,
    t.direction,
    t.amount_cents / 100.0 AS amount_yuan,
    g.name AS category_group,
    c.name AS category,
    c.nature,
    coalesce((
        SELECT group_concat(tag.name, ',')
        FROM transaction_tags AS tt
        JOIN tags AS tag ON tag.id = tt.tag_id
        WHERE tt.transaction_id = t.id
    ), '') AS tags,
    t.note,
    t.source_category,
    t.source_record_id
FROM transactions AS t
JOIN categories AS c ON c.id = t.category_id
JOIN category_groups AS g ON g.id = c.group_id;
