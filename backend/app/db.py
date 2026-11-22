"""SQLite helpers (stdlib sqlite3 only) and schema initialisation."""

import sqlite3
from datetime import datetime, timezone
from typing import Iterator

from app.config import DB_PATH

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL CHECK (role IN ('donor','ngo','volunteer','sponsor','admin')),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    phone TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (verification_status IN ('pending','verified','rejected')),
    anonymous_public INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS donor_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    donor_type TEXT CHECK (donor_type IN ('restaurant','caterer','hotel','event_organiser','wedding_host')),
    business_name TEXT,
    address TEXT,
    lat REAL,
    lng REAL
);

CREATE TABLE IF NOT EXISTS organisations (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    org_type TEXT,
    address TEXT,
    service_lat REAL,
    service_lng REAL,
    service_radius_km REAL,
    beneficiary_capacity INTEGER
);

CREATE TABLE IF NOT EXISTS volunteer_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    address TEXT,
    service_lat REAL,
    service_lng REAL,
    service_radius_km REAL,
    max_claim_kg REAL
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organiser_user_id INTEGER NOT NULL REFERENCES users(id),
    caterer_user_id INTEGER REFERENCES users(id),
    name TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('wedding','event')),
    event_date TEXT
);

CREATE TABLE IF NOT EXISTS donations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    donor_user_id INTEGER NOT NULL REFERENCES users(id),
    event_id INTEGER REFERENCES events(id),
    food_name TEXT NOT NULL,
    category TEXT,
    veg_type TEXT CHECK (veg_type IN ('veg','non_veg','mixed')),
    quantity_kg REAL,
    estimated_portions INTEGER,
    prep_time_at TEXT,
    storage_condition TEXT,
    allergens TEXT,
    pickup_deadline TEXT,
    pickup_address TEXT,
    pickup_lat REAL,
    pickup_lng REAL,
    status TEXT NOT NULL DEFAULT 'posted',
    quantity_available_kg REAL,
    anonymous_donor INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    donation_id INTEGER NOT NULL REFERENCES donations(id),
    receiver_user_id INTEGER NOT NULL REFERENCES users(id),
    quantity_kg REAL,
    status TEXT NOT NULL CHECK (status IN ('offered','claimed','rejected','expired',
        'pickup_confirmed','collected','distributed','cancelled')),
    claim_expires_at TEXT,
    collected_kg REAL NOT NULL DEFAULT 0,
    distributed_kg REAL NOT NULL DEFAULT 0,
    beneficiaries_reached INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS donation_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    donation_id INTEGER NOT NULL REFERENCES donations(id),
    claim_id INTEGER REFERENCES claims(id),
    actor_user_id INTEGER REFERENCES users(id),
    from_status TEXT,
    to_status TEXT,
    note TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sponsors (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    organisation_name TEXT,
    programme_name TEXT,
    funding_allocation_inr REAL
);

CREATE TABLE IF NOT EXISTS funding_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sponsor_user_id INTEGER NOT NULL REFERENCES users(id),
    amount_inr REAL NOT NULL,
    programme_name TEXT,
    entry_date TEXT,
    note TEXT
);

CREATE TABLE IF NOT EXISTS disputes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    donation_id INTEGER NOT NULL REFERENCES donations(id),
    claim_id INTEGER REFERENCES claims(id),
    reporter_user_id INTEGER NOT NULL REFERENCES users(id),
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_claims_donation ON claims(donation_id);
CREATE INDEX IF NOT EXISTS idx_claims_receiver ON claims(receiver_user_id);
"""


def utcnow_iso() -> str:
    """Current UTC time as an ISO-8601 string (second precision, +00:00 offset)."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def get_conn() -> sqlite3.Connection:
    """Open a new SQLite connection with Row results and foreign keys enabled."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_schema() -> None:
    """Create all tables and indexes if they do not already exist (idempotent)."""
    conn = get_conn()
    try:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
    finally:
        conn.close()


def get_db() -> Iterator[sqlite3.Connection]:
    """FastAPI dependency: yield a connection and close it afterwards."""
    conn = get_conn()
    try:
        yield conn
    finally:
        conn.close()
