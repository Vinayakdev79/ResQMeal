"""ResQMeal FastAPI application entry point.

Run from the backend folder:
    uvicorn app.main:app --reload --port 8000
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import get_conn, init_schema
from app.routers import auth, users
from seed import seed_demo


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Startup: create schema if needed, then seed synthetic demo data on an empty database.
    init_schema()
    conn = get_conn()
    try:
        count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    finally:
        conn.close()
    if count == 0:
        seed_demo()
    yield


app = FastAPI(title="ResQMeal API", lifespan=lifespan)

app.include_router(auth.router)
app.include_router(users.router)

# Routers for donations, impact, reports, sponsor and admin are added in later
# phases (their modules are currently docstring-only stubs). Include them here
# once they define a `router`, e.g.:
#     from app.routers import donations
#     app.include_router(donations.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "resqmeal"}


# Static frontend hook (later phase, not mounted yet). The frontend lives in
# ../frontend relative to the backend folder, e.g.:
#     from pathlib import Path
#     from fastapi.staticfiles import StaticFiles
#     FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
#     app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
