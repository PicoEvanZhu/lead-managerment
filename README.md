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
- `GET /approval/form-templates`
- `POST /approval/form-templates`
- `PATCH /approval/form-templates/:id`
- `GET /approval/process-templates`
- `POST /approval/process-templates/validate`
- `POST /approval/process-templates`
- `PATCH /approval/process-templates/:id`
- `GET /approval/instances`
- `POST /approval/instances`
- `GET /approval/instances/:id`
- `POST /approval/instances/:id/actions`

## Approval Workflow Config
- Form template `schema` is an array of field definitions:
```json
[
  { "key": "amount", "label": "申请金额", "type": "number", "required": true },
  { "key": "reason", "label": "申请原因", "type": "textarea", "required": true },
  { "key": "category", "label": "类型", "type": "select", "options": ["A", "B"] }
]
```
- Process template `steps` is an array of approval nodes:
```json
[
  { "step_type": "approval", "name": "直属负责人审批", "approver_type": "manager", "approval_mode": "any" },
  {
    "step_type": "approval",
    "name": "财务审批",
    "approver_type": "role",
    "approver_roles": ["subsidiary_admin"],
    "approval_mode": "any",
    "condition": {
      "logic": "and",
      "rules": [{ "field": "amount", "operator": "gte", "value": 10000 }]
    }
  },
  { "step_type": "cc", "name": "抄送发起人", "approver_type": "user", "approver_user_ids": [1] }
]
```
- Process template also supports `definition` (graph mode) for visual designer:
```json
{
  "version": "graph_v1",
  "start_node_id": "start",
  "nodes": [
    { "id": "start", "name": "开始", "node_type": "start" },
    { "id": "n1", "name": "部门审批", "node_type": "approval", "approver_type": "manager" },
    { "id": "n2", "name": "结束", "node_type": "end" }
  ],
  "edges": [
    { "id": "e1", "source": "start", "target": "n1", "priority": 1 },
    { "id": "e2", "source": "n1", "target": "n2", "priority": 1, "is_default": true }
  ]
}
```
- Process template lifecycle uses `status`:
  - `inactive` = 草稿（可编辑，不可发起）
  - `active` = 已发布（可发起）
- 发布时会执行流程校验（可达性、死路、循环、条件节点默认分支）。
- Supported field types: `text`, `textarea`, `number`, `date`, `select`, `boolean`.
- Supported approver types: `user`, `role`, `manager`.
- Supported step types: `approval`, `cc`.
- Supported condition operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `contains`, `is_true`, `is_false`, `is_empty`, `not_empty`.

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
