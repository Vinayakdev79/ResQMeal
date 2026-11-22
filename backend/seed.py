"""Synthetic demo data for ResQMeal (fictional people, organisations and places only).

Usage (from the backend folder):
    python -m seed

seed_demo() is idempotent: it does nothing if the admin account already exists.
All demo accounts use the password "Demo@1234".
"""

from app.db import get_conn, init_schema, utcnow_iso
from app.security import hash_password

DEMO_PASSWORD = "Demo@1234"
ADMIN_EMAIL = "admin@resqmeal.example"


def _insert_user(conn, role: str, name: str, email: str, pw_hash: str, now: str) -> int:
    cur = conn.execute(
        "INSERT INTO users (role, name, email, password_hash, phone, verification_status, "
        "anonymous_public, created_at) VALUES (?, ?, ?, ?, NULL, 'verified', 0, ?)",
        (role, name, email, pw_hash, now),
    )
    return cur.lastrowid


def seed_demo() -> bool:
    """Insert synthetic demo accounts, sponsor data and one event.

    Returns True if data was inserted, False if it was already present.
    """
    init_schema()
    conn = get_conn()
    try:
        if conn.execute("SELECT 1 FROM users WHERE email = ?", (ADMIN_EMAIL,)).fetchone():
            return False

        now = utcnow_iso()
        pw_hash = hash_password(DEMO_PASSWORD)

        # Admin
        _insert_user(conn, "admin", "ResQMeal Admin", ADMIN_EMAIL, pw_hash, now)

        # Donors
        restaurant_id = _insert_user(conn, "donor", "Hotel Yamuna Vista (fictional)",
                                     "restaurant@resqmeal.example", pw_hash, now)
        conn.execute(
            "INSERT INTO donor_profiles (user_id, donor_type, business_name, address, lat, lng) "
            "VALUES (?, 'restaurant', ?, ?, ?, ?)",
            (restaurant_id, "Hotel Yamuna Vista (fictional)",
             "Krishna Nagar Road, Mathura (fictional)", 27.4924, 77.6737),
        )

        caterer_id = _insert_user(conn, "donor", "Radha Kunj Caterers (fictional)",
                                  "caterer@resqmeal.example", pw_hash, now)
        conn.execute(
            "INSERT INTO donor_profiles (user_id, donor_type, business_name, address, lat, lng) "
            "VALUES (?, 'caterer', ?, ?, ?, ?)",
            (caterer_id, "Radha Kunj Caterers (fictional)",
             "Radha Kunj Road, Mathura (fictional)", 27.4850, 77.6900),
        )

        organiser_id = _insert_user(conn, "donor", "Brij Celebrations (fictional)",
                                    "organiser@resqmeal.example", pw_hash, now)
        conn.execute(
            "INSERT INTO donor_profiles (user_id, donor_type, business_name, address, lat, lng) "
            "VALUES (?, 'event_organiser', ?, ?, ?, ?)",
            (organiser_id, "Brij Celebrations (fictional)",
             "Civil Lines, Mathura (fictional)", 27.4700, 77.6600),
        )

        # NGOs
        ngo1_id = _insert_user(conn, "ngo", "Shanti Sewa Foundation (fictional NGO)",
                               "ngo1@resqmeal.example", pw_hash, now)
        conn.execute(
            "INSERT INTO organisations (user_id, org_type, address, service_lat, service_lng, "
            "service_radius_km, beneficiary_capacity) VALUES (?, 'ngo', ?, 27.4900, 77.6700, 12, 300)",
            (ngo1_id, "Vishram Ghat Area, Mathura (fictional)"),
        )

        ngo2_id = _insert_user(conn, "ngo", "Gokul Community Kitchen (fictional NGO)",
                               "ngo2@resqmeal.example", pw_hash, now)
        conn.execute(
            "INSERT INTO organisations (user_id, org_type, address, service_lat, service_lng, "
            "service_radius_km, beneficiary_capacity) VALUES (?, 'ngo', ?, 27.5050, 77.6550, 10, 150)",
            (ngo2_id, "Gokul Road, Mathura (fictional)"),
        )

        # Volunteers (independent volunteers, not delivery partners)
        volunteers = [
            ("Anita Sharma (fictional volunteer)", "volunteer1@resqmeal.example",
             "Holi Gate Area, Mathura (fictional)", 27.4920, 77.6700, 8),
            ("Rohit Verma (fictional volunteer)", "volunteer2@resqmeal.example",
             "Station Road, Mathura (fictional)", 27.4800, 77.6800, 8),
            ("Meera Joshi (fictional volunteer)", "volunteer3@resqmeal.example",
             "Gokul Road, Mathura (fictional)", 27.5000, 77.6600, 10),
        ]
        for name, email, address, lat, lng, radius in volunteers:
            vid = _insert_user(conn, "volunteer", name, email, pw_hash, now)
            conn.execute(
                "INSERT INTO volunteer_profiles (user_id, address, service_lat, service_lng, "
                "service_radius_km, max_claim_kg) VALUES (?, ?, ?, ?, ?, 50.0)",
                (vid, address, lat, lng, radius),
            )

        # Sponsor
        sponsor_id = _insert_user(conn, "sponsor", "Yamuna Green CSR Trust (fictional)",
                                  "sponsor@resqmeal.example", pw_hash, now)
        conn.execute(
            "INSERT INTO sponsors (user_id, organisation_name, programme_name, "
            "funding_allocation_inr) VALUES (?, ?, ?, 500000)",
            (sponsor_id, "Yamuna Green CSR Trust (fictional)", "Mathura Food Rescue Pilot"),
        )
        conn.execute(
            "INSERT INTO funding_ledger (sponsor_user_id, amount_inr, programme_name, entry_date, note) "
            "VALUES (?, 150000, ?, ?, ?)",
            (sponsor_id, "Mathura Food Rescue Pilot", "2026-01-15",
             "Initial tranche (synthetic demo entry)"),
        )

        # Event: wedding organised by Brij Celebrations, catered by Radha Kunj Caterers
        conn.execute(
            "INSERT INTO events (organiser_user_id, caterer_user_id, name, event_type, event_date) "
            "VALUES (?, ?, ?, 'wedding', ?)",
            (organiser_id, caterer_id, "Sharma Family Wedding (fictional)", "2026-03-15"),
        )

        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    init_schema()
    seed_demo()
    print("ResQMeal demo data seeded (or already present). Password for demo accounts: Demo@1234")
