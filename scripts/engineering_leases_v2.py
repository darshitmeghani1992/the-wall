#!/usr/bin/env python3
"""Durable, local-only task leases for a future approved cloud orchestrator.

This module never invokes coding models, GitHub writes or hosted systems.
SQLite coordinates one shared durable file on one host; a multi-host deployment
MUST replace it with a transactional shared database. Tests use temporary DBs.
"""
import argparse
import json
import sqlite3
import time
from pathlib import Path

MAX_WORKERS = 3
ROLES = frozenset(("FRONTEND", "BACKEND"))

def connect(path):
    conn = sqlite3.connect(str(path), isolation_level=None, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=10000")
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS leases (
          task_id TEXT PRIMARY KEY, branch TEXT NOT NULL UNIQUE,
          role TEXT NOT NULL, owner TEXT NOT NULL,
          token INTEGER NOT NULL, expires_at INTEGER NOT NULL,
          state TEXT NOT NULL CHECK(state IN ('active','released'))
        );
        CREATE TABLE IF NOT EXISTS counters (
          name TEXT PRIMARY KEY, value INTEGER NOT NULL
        );
        INSERT OR IGNORE INTO counters(name,value) VALUES('fence',0);
        CREATE TABLE IF NOT EXISTS delivered_events (
          event_id TEXT PRIMARY KEY, observed_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS completed_tasks (
          task_id TEXT PRIMARY KEY, owner TEXT NOT NULL,
          token INTEGER NOT NULL, event_id TEXT NOT NULL UNIQUE,
          completed_at INTEGER NOT NULL
        );
    """)
    return conn

def claim(conn, *, task_id, branch, role, owner, now=None, ttl=300, max_workers=MAX_WORKERS):
    now = int(time.time()) if now is None else int(now)
    if not all(isinstance(v, str) and v.strip() for v in (task_id, branch, owner)):
        raise ValueError("task_id, branch and owner must be nonempty")
    if role not in ROLES or not 1 <= max_workers <= MAX_WORKERS or not 1 <= ttl <= 3600:
        raise ValueError("invalid role, worker cap or bounded TTL")
    if not branch.startswith("codex/cloud-worker-"):
        raise ValueError("task branch must use isolated cloud worker prefix")
    conn.execute("BEGIN IMMEDIATE")
    try:
        if conn.execute("SELECT 1 FROM completed_tasks WHERE task_id=?", (task_id,)).fetchone():
            conn.execute("COMMIT")
            return None
        existing = conn.execute("SELECT * FROM leases WHERE task_id=?", (task_id,)).fetchone()
        if existing and existing["state"] == "active" and existing["expires_at"] > now:
            conn.execute("COMMIT")
            return None
        other = conn.execute(
            "SELECT 1 FROM leases WHERE branch=? AND task_id<>? AND state='active' AND expires_at>?",
            (branch, task_id, now),
        ).fetchone()
        if other:
            conn.execute("COMMIT")
            return None
        active = conn.execute(
            "SELECT COUNT(*) FROM leases WHERE state='active' AND expires_at>?", (now,)
        ).fetchone()[0]
        if active >= max_workers:
            conn.execute("COMMIT")
            return None
        conn.execute("UPDATE counters SET value=value+1 WHERE name='fence'")
        token = conn.execute("SELECT value FROM counters WHERE name='fence'").fetchone()[0]
        # Fully expire old branch assignments, but never steal an active lease.
        conn.execute(
            "DELETE FROM leases WHERE branch=? AND task_id<>? AND (state='released' OR expires_at<=?)",
            (branch, task_id, now),
        )
        conn.execute("""
            INSERT INTO leases(task_id,branch,role,owner,token,expires_at,state)
            VALUES(?,?,?,?,?,?,'active')
            ON CONFLICT(task_id) DO UPDATE SET
              branch=excluded.branch,role=excluded.role,owner=excluded.owner,
              token=excluded.token,expires_at=excluded.expires_at,state='active'
        """, (task_id, branch, role, owner, token, now + ttl))
        conn.execute("COMMIT")
        return token
    except Exception:
        conn.execute("ROLLBACK")
        raise

def renew(conn, task_id, owner, token, *, now=None, ttl=300):
    now = int(time.time()) if now is None else int(now)
    if not 1 <= ttl <= 3600:
        raise ValueError("invalid TTL")
    cur = conn.execute("""
        UPDATE leases SET expires_at=? WHERE task_id=? AND owner=? AND token=?
        AND state='active' AND expires_at>?
    """, (now + ttl, task_id, owner, token, now))
    return cur.rowcount == 1

def release(conn, task_id, owner, token, *, now=None):
    now = int(time.time()) if now is None else int(now)
    cur = conn.execute("""
        UPDATE leases SET state='released',expires_at=? WHERE task_id=? AND owner=?
        AND token=? AND state='active' AND expires_at>?
    """, (now, task_id, owner, token, now))
    return cur.rowcount == 1

def complete(conn, task_id, owner, token, event_id, *, now=None):
    """Atomically close one live fenced lease and deduplicate its completion event.

    Completion is local dispatcher bookkeeping, not product QA, merge or release.
    On duplicate event, stale token, prior completion or exception, nothing changes.
    """
    if not isinstance(event_id, str) or not event_id.strip():
        raise ValueError("event id required")
    now = int(time.time()) if now is None else int(now)
    conn.execute("BEGIN IMMEDIATE")
    try:
        lease = conn.execute("""
            SELECT 1 FROM leases WHERE task_id=? AND owner=? AND token=?
            AND state='active' AND expires_at>?
        """, (task_id, owner, token, now)).fetchone()
        if not lease:
            conn.execute("COMMIT")
            return False
        if conn.execute("SELECT 1 FROM delivered_events WHERE event_id=?", (event_id,)).fetchone():
            conn.execute("COMMIT")
            return False
        if conn.execute("SELECT 1 FROM completed_tasks WHERE task_id=?", (task_id,)).fetchone():
            conn.execute("COMMIT")
            return False
        conn.execute("INSERT INTO delivered_events(event_id,observed_at) VALUES(?,?)",
                     (event_id, now))
        conn.execute("""
            INSERT INTO completed_tasks(task_id,owner,token,event_id,completed_at)
            VALUES(?,?,?,?,?)
        """, (task_id, owner, token, event_id, now))
        updated = conn.execute("""
            UPDATE leases SET state='released',expires_at=?
            WHERE task_id=? AND owner=? AND token=? AND state='active' AND expires_at>?
        """, (now, task_id, owner, token, now))
        if updated.rowcount != 1:
            raise RuntimeError("fenced lease changed during atomic completion")
        conn.execute("COMMIT")
        return True
    except Exception:
        conn.execute("ROLLBACK")
        raise

def completed_ids(conn):
    """Durable local bookkeeping prevents reassigning finished simulation tasks."""
    return {row[0] for row in conn.execute("SELECT task_id FROM completed_tasks")}

def record_event(conn, event_id, *, now=None):
    if not isinstance(event_id, str) or not event_id.strip():
        raise ValueError("event id required")
    now = int(time.time()) if now is None else int(now)
    result = conn.execute(
        "INSERT OR IGNORE INTO delivered_events(event_id,observed_at) VALUES(?,?)",
        (event_id, now),
    )
    return result.rowcount == 1

def snapshot(conn, *, now=None):
    now = int(time.time()) if now is None else int(now)
    rows = conn.execute("""
        SELECT task_id,branch,role,owner,token,expires_at
        FROM leases WHERE state='active' AND expires_at>? ORDER BY token
    """, (now,)).fetchall()
    return [dict(row) for row in rows]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True, help="local shared coordinator SQLite path")
    parser.add_argument("--dry-run", action="store_true", required=True)
    args = parser.parse_args()
    db = Path(args.db)
    if not db.parent.exists():
        raise SystemExit("DB directory must exist")
    con = connect(db)
    print(json.dumps({"mode": "dry-run", "active": snapshot(con)}, indent=2))
    con.close()

if __name__ == "__main__":
    main()
