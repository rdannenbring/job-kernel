# Docker Compose Deployment

This is the recommended way to run JobApplicationAutomator in production.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/install/) (v2.x+)

## Quick Start

### 1. Configure the application

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set at minimum:

| Variable | Description |
|---|---|
| `INITIAL_ADMIN_USERNAME` | Username for the first admin account |
| `INITIAL_ADMIN_PASSWORD` | Password for the first admin account |
| `OPENAI_API_KEY` | Your AI provider API key |
| `DEFAULT_AI_PROVIDER` | `openai`, `anthropic`, `ollama`, etc. |

### 2. Configure Docker Compose

```bash
cp .env.example .env
```

Edit `.env` to adjust ports or set `VITE_ONLYOFFICE_URL` to your server's IP/domain if not running locally.

### 3. Build and launch

```bash
docker compose up -d --build
```

### 4. Open the app

```
http://localhost
```

Log in with the admin credentials you set in step 1.

---

## Services

| Service | Default Port | Description |
|---|---|---|
| Frontend (Nginx + React) | 80 | Main application UI |
| OnlyOffice Document Server | 8443 | In-browser resume editor |
| Backend (FastAPI) | internal | API server (not publicly exposed) |

The backend is not exposed publicly — all `/api/*` calls are proxied through Nginx.

---

## Optional: Mount a Local Documents Folder

If you have a local folder of base resumes you want accessible in the app, set `DOCUMENTS_HOST_PATH` in the root `.env`:

```env
DOCUMENTS_HOST_PATH=/path/to/your/documents
```

Then uncomment the corresponding volume line in `docker-compose.yml`:

```yaml
volumes:
  - app_data:/data
  - ${DOCUMENTS_HOST_PATH}:/mnt/documents:ro   # ← uncomment this
```

---

## Optional: PostgreSQL Instead of SQLite

By default the app uses SQLite stored in a Docker named volume. For multi-user production deployments, PostgreSQL is recommended.

In the root `.env`, uncomment and set:

```env
POSTGRES_USER=jobapp
POSTGRES_PASSWORD=changeme
POSTGRES_DB=jobapp_db
DATABASE_URL=postgresql://jobapp:changeme@db:5432/jobapp_db
```

Then launch with the `postgres` profile:

```bash
docker compose --profile postgres up -d --build
```

---

## Updating

```bash
git pull
docker compose up -d --build
```

The application automatically runs schema migrations on startup — no manual migration steps needed.

---

## Stopping

```bash
docker compose down           # Stop containers (data preserved in volumes)
docker compose down -v        # Stop containers AND delete all data volumes
```

---

## Logs

```bash
docker compose logs -f backend    # Backend logs
docker compose logs -f frontend   # Nginx logs
```
