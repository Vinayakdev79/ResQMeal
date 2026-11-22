"""Admin user-management endpoints (mounted under /api/admin)."""

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, status

from app.db import get_db
from app.deps import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users")
def list_users(
    _admin: dict = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
) -> list[dict]:
    rows = db.execute(
        "SELECT id, role, name, email, verification_status FROM users ORDER BY id"
    ).fetchall()
    return [dict(r) for r in rows]


def _set_verification(db: sqlite3.Connection, user_id: int, new_status: str) -> dict:
    cur = db.execute(
        "UPDATE users SET verification_status = ? WHERE id = ?", (new_status, user_id)
    )
    if cur.rowcount == 0:
        db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    db.commit()
    row = db.execute(
        "SELECT id, role, name, email, verification_status FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    return dict(row)


@router.post("/users/{user_id}/verify")
def verify_user(
    user_id: int,
    _admin: dict = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    return _set_verification(db, user_id, "verified")


@router.post("/users/{user_id}/reject")
def reject_user(
    user_id: int,
    _admin: dict = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    return _set_verification(db, user_id, "rejected")
