"""Authentication endpoints: register, login, logout, current user."""

import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.config import SESSION_TTL_HOURS
from app.db import get_db, utcnow_iso
from app.deps import build_user_out, extract_bearer, get_current_user
from app.schemas import LoginIn, RegisterIn, TokenOut, UserOut
from app.security import hash_password, new_session_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _create_session(db: sqlite3.Connection, user_id: int) -> tuple[str, str]:
    token = new_session_token()
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(hours=SESSION_TTL_HOURS)).isoformat(timespec="seconds")
    db.execute(
        "INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
        (token, user_id, expires_at, now.isoformat(timespec="seconds")),
    )
    return token, expires_at


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, db: sqlite3.Connection = Depends(get_db)) -> TokenOut:
    if body.role == "donor" and not body.donor_type:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "donor_type is required for donors")

    email = body.email.strip().lower()
    if db.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    now = utcnow_iso()
    cur = db.execute(
        "INSERT INTO users (role, name, email, password_hash, phone, verification_status, "
        "anonymous_public, created_at) VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)",
        (body.role, body.name.strip(), email, hash_password(body.password),
         body.phone, now),
    )
    user_id = cur.lastrowid

    if body.role == "donor":
        db.execute(
            "INSERT INTO donor_profiles (user_id, donor_type, business_name, address, lat, lng) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, body.donor_type, body.business_name, body.address, body.lat, body.lng),
        )
    elif body.role == "ngo":
        db.execute(
            "INSERT INTO organisations (user_id, org_type, address, service_lat, service_lng, "
            "service_radius_km, beneficiary_capacity) VALUES (?, 'ngo', ?, ?, ?, ?, ?)",
            (user_id, body.address, body.service_lat, body.service_lng,
             body.service_radius_km, body.beneficiary_capacity),
        )
    elif body.role == "volunteer":
        db.execute(
            "INSERT INTO volunteer_profiles (user_id, address, service_lat, service_lng, "
            "service_radius_km, max_claim_kg) VALUES (?, ?, ?, ?, ?, 50.0)",
            (user_id, body.address, body.service_lat, body.service_lng, body.service_radius_km),
        )
    elif body.role == "sponsor":
        db.execute(
            "INSERT INTO sponsors (user_id, organisation_name, programme_name, "
            "funding_allocation_inr) VALUES (?, ?, NULL, 0)",
            (user_id, body.business_name or body.name.strip()),
        )

    token, expires_at = _create_session(db, user_id)
    db.commit()
    return TokenOut(token=token, expires_at=expires_at, user=build_user_out(db, user_id))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: sqlite3.Connection = Depends(get_db)) -> TokenOut:
    email = body.email.strip().lower()
    row = db.execute("SELECT id, password_hash FROM users WHERE email = ?", (email,)).fetchone()
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password",
                            headers={"WWW-Authenticate": "Bearer"})
    token, expires_at = _create_session(db, row["id"])
    db.commit()
    return TokenOut(token=token, expires_at=expires_at, user=build_user_out(db, row["id"]))


@router.post("/logout")
def logout(
    authorization: Optional[str] = Header(default=None),
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    token = extract_bearer(authorization)
    if token:
        db.execute("DELETE FROM sessions WHERE token = ?", (token,))
        db.commit()
    return {"status": "logged_out"}


@router.get("/me", response_model=UserOut)
def me(user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)) -> UserOut:
    return build_user_out(db, user["id"])
