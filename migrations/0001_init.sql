-- 分组表
CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    color TEXT DEFAULT '#1a1a1a',
    created_at TEXT DEFAULT (datetime('now'))
);

-- 默认分组
INSERT INTO groups (name, description) VALUES ('默认分组', '默认分组');

-- 邮箱账号表
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT DEFAULT '',
    client_id TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    group_id INTEGER DEFAULT 1,
    remark TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (group_id) REFERENCES groups (id)
);

CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts (email);
CREATE INDEX IF NOT EXISTS idx_accounts_group_id ON accounts (group_id);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts (status);
