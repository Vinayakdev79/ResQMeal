"""Application settings, read from environment variables."""

import os
from pathlib import Path

# The backend folder (the directory containing requirements.txt and seed.py).
BACKEND_DIR = Path(__file__).resolve().parent.parent

# SQLite database path. Override with the RESQMEAL_DB environment variable.
# A relative value is resolved against the backend folder.
_db_setting = os.environ.get("RESQMEAL_DB", "data/resqmeal.db")
DB_PATH = Path(_db_setting)
if not DB_PATH.is_absolute():
    DB_PATH = (BACKEND_DIR / DB_PATH).resolve()

# Session lifetime for bearer tokens.
SESSION_TTL_HOURS = 12
