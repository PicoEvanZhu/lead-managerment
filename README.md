# Lead Management MVP (Opportunity System)

Minimal API for opportunity management with group/subsidiary data isolation.

## Structure
- `backend/`: Python API service
- `frontend/`: Vite + React (TypeScript) frontend

## Requirements
- Python 3.10+
- MySQL 8+

## Setup
1) Create a virtual environment and install dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

2) Ensure `.env` contains the MySQL connection values.

3) Run the migration:

```bash
python backend/scripts/migrate.py
```

4) Create a company and user (example):

```sql
INSERT INTO companies (name, code) VALUES ('Group HQ', 'GROUP');
INSERT INTO companies (name, code, parent_id) VALUES ('Subsidiary A', 'SUB-A', 1);
INSERT INTO users (name, email, role, company_id)
VALUES ('Admin A', 'admin-a@example.com', 'subsidiary_admin', 2);
INSERT INTO users (name, email, role, company_id)
VALUES ('Sales A', 'sales-a@example.com', 'sales', 2);
```

5) Start the backend API:

```bash
python backend/app.py
```

6) Start the frontend (Vite dev server):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 to access the frontend.

## Deployment (Server)
Do **not** store passwords, private keys, or API keys in this repository or README. Keep secrets in server-side `.env` or a secrets manager.

### SSH (example)
Use an SSH key already on your machine and a host config entry, e.g.:
```text
Host lead-managerment
  HostName 106.54.39.43
  User root
  IdentityFile ~/.ssh/pm_ed25519
```

### Backend (simple systemd)
1) Copy the repo to the server (or git clone).
2) Create `.env` on the server with MySQL connection values.
3) Install dependencies:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
python backend/scripts/migrate.py
```
4) Run the API (production option: systemd or gunicorn).

### Frontend (static build)
```bash
cd frontend
npm ci
npm run build
```
Serve `frontend/dist` behind Nginx or a static server.

## Auth
All endpoints (except `/login` and `/health`) require `x-user-id` header. The user is loaded from the database.

### Admin Login
Use the admin credentials to log in and obtain a user id:
- username: `admin-pico`
- password: `pico@2026`

## API Summary
- `GET /health`
- `GET /opportunities`
- `POST /opportunities`
- `GET /opportunities/:id`
- `PATCH /opportunities/:id`
- `POST /opportunities/:id/activities`
- `GET /opportunities/:id/activities`
- `PUT /opportunities/:id/tags`
- `GET /tags`
- `POST /tags`

## Example Requests
```bash
curl -X POST http://localhost:3000/opportunities \
  -H 'Content-Type: application/json' \
  -H 'x-user-id: 2' \
  -d '{
    "name": "Auto Expo Booth Build",
    "type": "normal",
    "source": "onsite",
    "industry": "automotive",
    "city": "Shanghai"
  }'
```

```bash
curl -X POST http://localhost:3000/opportunities/1/activities \
  -H 'Content-Type: application/json' \
  -H 'x-user-id: 2' \
  -d '{
    "channel": "phone",
    "result": "intro call done",
    "next_step": "send proposal"
  }'
```


/opt/lead-management