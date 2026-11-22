# ResQMeal – Smart Food Rescue & Impact Platform

ResQMeal connects surplus edible food from restaurants, caterers, hotels, event organisers and wedding hosts with NGOs, community kitchens and independent volunteers, so that food is rescued before it goes to waste. The platform coordinates donations, receiver matching, self-pickup, distribution tracking and measurable social and environmental impact.

**Important:** volunteers are NOT delivery partners. They are independent people who choose to collect and distribute food themselves within a service area. ResQMeal coordinates donations; it does NOT certify food safety and does NOT guarantee the safety of any food. Donors and receivers remain responsible for handling food safely.

Pilot launch area: Mathura, India. All demo people, organisations, places and events are fictional.

## Stack

- Python 3, FastAPI, Uvicorn
- Pydantic v2 for request/response models
- SQLite via the Python standard library (`sqlite3`)
- PBKDF2-SHA256 password hashing (standard library `hashlib`)
- ReportLab for PDF reports (later phase)
- httpx for the test client

## Run on Windows

From a Command Prompt or PowerShell:

```
cd ResQMeal\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The database is created automatically at `backend\data\resqmeal.db` on first start. To use another location, set the `RESQMEAL_DB` environment variable before starting (a relative path is resolved against the backend folder).

Health check: open `http://127.0.0.1:8000/api/health`, which returns `{"status":"ok","service":"resqmeal"}`.

## Seed demo data

On first start the database is seeded automatically if it is empty. To seed manually (safe to run repeatedly; it skips if the demo data already exists), from the `backend` folder:

```
python -m seed
```

## Demo accounts

All demo accounts use the password **Demo@1234**. All data is synthetic.

| Email | Role | Notes |
|---|---|---|
| admin@resqmeal.example | admin | ResQMeal Admin |
| restaurant@resqmeal.example | donor (restaurant) | Hotel Yamuna Vista (fictional) |
| caterer@resqmeal.example | donor (caterer) | Radha Kunj Caterers (fictional) |
| organiser@resqmeal.example | donor (event_organiser) | Brij Celebrations (fictional) |
| ngo1@resqmeal.example | ngo | Shanti Sewa Foundation (fictional NGO) |
| ngo2@resqmeal.example | ngo | Gokul Community Kitchen (fictional NGO) |
| volunteer1@resqmeal.example | volunteer | Anita Sharma (fictional volunteer) |
| volunteer2@resqmeal.example | volunteer | Rohit Verma (fictional volunteer) |
| volunteer3@resqmeal.example | volunteer | Meera Joshi (fictional volunteer) |
| sponsor@resqmeal.example | sponsor | Yamuna Green CSR Trust (fictional) |

## API so far

- `GET /api/health`
- `POST /api/auth/register` (returns a bearer token; donors must give a `donor_type`; `admin` cannot self-register)
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/admin/users` (admin)
- `POST /api/admin/users/{id}/verify` (admin)
- `POST /api/admin/users/{id}/reject` (admin)

Send the token as `Authorization: Bearer <token>`. Sessions last 12 hours.

## Impact metrics (estimates)

- Meals saved = verified distributed kg / 0.4
- Emissions avoided are **estimates** only. The emissions formula and its factors will be documented in the impact phase.
