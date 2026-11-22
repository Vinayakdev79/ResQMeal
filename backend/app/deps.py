"""FastAPI dependencies: bearer-token authentication and role checks."""

import sqlite3
from typing import Optional

from fastapi import Depends, Header, HTTPException, status

from app.db import get_db, utcnow_iso
from app.schemas import UserOut


def extract_bearer(authorization: Optional[str]) -> Optional[str]:
    """Return the token from an "Authorization: Bearer <token>" header value."""
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    """Resolve the bearer token to a user; 401 if missing, unknown or expired."""
    token = extract_bearer(authorization)
    if token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated",
                            headers={"WWW-Authenticate": "Bearer"})
    row = db.execute(
        """
        SELECT u.id, u.role, u.name, u.email, u.verification_status,
               u.anonymous_public, s.expires_at
        FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = ?
        """,
        (token,),
    ).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid session",
                            headers={"WWW-Authenticate": "Bearer"})
    if row["expires_at"] <= utcnow_iso():
        db.execute("DELETE FROM sessions WHERE token = ?", (token,))
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired",
                            headers={"WWW-Authenticate": "Bearer"})
    return dict(row)


def require_roles(*roles: str):
    """Build a dependency that allows only the listed roles (403 otherwise)."""
    allowed = frozenset(roles)

    def _dependency(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Role not permitted")
        return user

    return _dependency


require_admin = require_roles("admin")


def build_user_out(db: sqlite3.Connection, user_id: int) -> UserOut:
    """Load a user row (plus donor_type where relevant) as a UserOut."""
    row = db.execute(
        "SELECT id, role, name, email, verification_status, anonymous_public "
        "FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    donor_type = None
    if row["role"] == "donor":
        prof = db.execute(
            "SELECT donor_type FROM donor_profiles WHERE user_id = ?", (user_id,)
        ).fetchone()
        donor_type = prof["donor_type"] if prof else None
    return UserOut(
        id=row["id"],
        role=row["role"],
        name=row["name"],
        email=row["email"],
        verification_status=row["verification_status"],
        anonymous_public=bool(row["anonymous_public"]),
        donor_type=donor_type,
    )
