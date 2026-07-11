# JudgeX — AI-Powered Competitive Programming Platform

JudgeX is a modern competitive programming platform: solve problems, execute code securely in Docker sandboxes, receive verdicts, climb the leaderboard, and get AI-powered compile-error guidance that never reveals solutions.

## Repository Layout

```
JudgeX/
├── backend/                 # Node.js + Express modular monolith + workers
├── frontend/                # React + TailwindCSS + Monaco SPA
├── docs/                    # Source-of-truth design documents
├── docker/                  # Dev infra notes + language sandbox images
├── docker-compose.yml       # Dev: Postgres + Redis + Ollama only
├── docker-compose.prod.yml  # Prod: API + workers + Postgres + Redis
├── .env.production.example  # Production env template (copy → .env.production)
└── .github/                 # CI workflows
```

## Design Documents (source of truth)

- `docs/PRD.md` — Product Requirements
- `docs/ARCHITECTURE.md` — System Architecture
- `docs/DATABASE_DESIGN.md` — PostgreSQL Database Design
- `docs/BACKEND_STRUCTURE.md` — Backend Architecture
- `docs/API_SPECIFICATION.md` — REST API Contract
- `docs/JUDGE_PIPELINE.md` — Judge pipeline & recovery

## Tech Stack

**Backend:** Node.js 20, Express, PostgreSQL, Redis, BullMQ, Docker (`dockerode`), JWT, bcrypt, Zod.

**Frontend:** React, Vite, TailwindCSS, React Router, Monaco Editor, Axios.

## Prerequisites

- **Node.js >= 20** (local/dev host runs)
- **Docker + Docker Compose** (infra and/or full production stack)
- **Git**

```bash
docker --version
docker compose version
node --version
```

---

## Local Development (host API + Docker infra)

Development keeps the API and workers on your machine. Compose only starts **Postgres, Redis, and Ollama**.

### 1. Environment

```bash
cp backend/.env.example backend/.env
# Edit JWT_SECRET at minimum. Defaults match docker-compose.yml ports.
```

### 2. Start infrastructure

```bash
docker compose up -d
docker compose ps          # wait until healthy
docker exec -it judgex-ollama ollama pull llama3   # optional AI
```

Details: [`docker/README.md`](docker/README.md).

### 3. Migrate & run backend

```bash
cd backend
npm install
npm run db:migrate
npm run dev                # API → http://localhost:4000

# Other terminals:
npm run worker:judge
npm run worker:cleanup
```

### 4. Sandbox images (required for real judging)

```bash
docker build -t judgex-python ./docker/images/python
docker build -t judgex-cpp ./docker/images/cpp
```

### 5. Frontend (optional)

```bash
cp frontend/.env.example frontend/.env
cd frontend && npm install && npm run dev
```

### Useful probes

| URL | Meaning |
|-----|---------|
| `GET http://localhost:4000/health` | Liveness (process up) |
| `GET http://localhost:4000/ready` | Readiness (Postgres + Redis + BullMQ) |
| `GET http://localhost:4000/api/v1/health` | Same readiness diagnostics |

### Tests

```bash
cd backend
npm run test:unit
npm run test:integration
npm run test:e2e          # needs Docker sandboxes + infra
```

---

## Production Deployment (full Docker Compose)

Production compose starts **API, judge worker, cleanup worker, PostgreSQL, and Redis** on a private bridge network with persistent volumes. The API **runs migrations before listening**.

### 1. Create production env

```bash
cp .env.production.example .env.production
```

Edit at least:

- `POSTGRES_PASSWORD` — strong password
- `JWT_SECRET` — **≥ 32 characters**
- `CORS_ORIGIN` — your frontend origin(s)

Compose injects `DATABASE_URL` / `REDIS_URL` using the internal service names `postgres` and `redis`. You do not need localhost URLs in production.

### 2. Build language sandbox images (on the Docker host)

The judge worker mounts the host Docker socket and starts sandboxes from these tags:

```bash
docker build -t judgex-python ./docker/images/python
docker build -t judgex-cpp ./docker/images/cpp
```

### 3. Build and start the stack

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml ps
```

### 4. Verify

```bash
curl -s http://localhost:4000/health
curl -s http://localhost:4000/ready
docker compose -f docker-compose.prod.yml logs -f api
```

### 5. Stop / reset

```bash
# Stop containers (keep volumes)
docker compose -f docker-compose.prod.yml down

# Destroy containers AND data volumes (destructive)
docker compose -f docker-compose.prod.yml down -v
```

### Production services

| Service | Image / Dockerfile | Role |
|---------|-------------------|------|
| `postgres` | `postgres:17-alpine` | Source of truth |
| `redis` | `redis:7-alpine` (AOF) | BullMQ + cache + rate limits |
| `api` | `backend/Dockerfile.api` | HTTP API; migrates then serves |
| `judge-worker` | `backend/Dockerfile.judge` | Consumes judge queue; needs Docker socket |
| `cleanup-worker` | `backend/Dockerfile.cleanup` | Stuck-queued reaper |

### Startup order

1. **postgres** / **redis** become `healthy`
2. **api** starts → entrypoint runs `db:migrate` → listens → `/ready` healthy
3. **judge-worker** and **cleanup-worker** start after `api` is healthy

### Networking & volumes

- Bridge network `judgex` — services reach each other by DNS name (`postgres`, `redis`, `api`)
- Volume `judgex_pgdata` — Postgres data
- Volume `judgex_redisdata` — Redis AOF
- Judge worker mounts `/var/run/docker.sock` for sandboxes (Docker Desktop on Windows/macOS maps this automatically)

### AI in production compose

Ollama is **not** part of `docker-compose.prod.yml` (keeps the core stack lean). Options:

1. Point `OLLAMA_BASE_URL` at a host Ollama (`http://host.docker.internal:11434`), or
2. Set `FEATURE_AI_COMPILE_EXPLANATION=false`, or
3. Set `AI_PROVIDER=openai` and provide `OPENAI_API_KEY`

---

## Runs Fully Free (default)

Default AI provider is local **Ollama** (no API key). Postgres, Redis, BullMQ, Docker, React, and Express are open-source. OpenAI is optional via config.

## License / status

Portfolio-grade MVP backend with production deployment packaging. Frontend work can proceed against the documented `/api/v1` contract once this stack is healthy.
