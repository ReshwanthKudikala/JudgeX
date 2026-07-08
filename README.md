# JudgeX — AI-Powered Competitive Programming Platform

JudgeX is a modern competitive programming platform: solve problems, execute code securely in Docker sandboxes, receive verdicts, climb the leaderboard, and get AI-powered compile-error guidance that never reveals solutions.

## Repository Layout

```
JudgeX/
├── backend/      # Node.js + Express modular monolith + background workers
├── frontend/     # React + TailwindCSS + Monaco SPA
├── docs/         # Source-of-truth design documents (PRD, ARCHITECTURE, DB, BACKEND, API)
├── docker/       # Dev infra docs; language sandbox images (compose is at repo root)
├── scripts/      # Ops scripts (migrate, seed, healthcheck)
├── testcases/    # Sample/local test-case fixtures
└── .github/      # CI workflows
```

## Design Documents (source of truth)

- `docs/PRD.md` — Product Requirements
- `docs/ARCHITECTURE.md` — System Architecture
- `docs/DATABASE_DESIGN.md` — PostgreSQL Database Design
- `docs/BACKEND_STRUCTURE.md` — Backend Architecture
- `docs/API_SPECIFICATION.md` — REST API Contract

## Tech Stack

**Backend:** Node.js, Express, PostgreSQL (`pg`), Redis (`ioredis`), BullMQ, Docker SDK (`dockerode`), JWT, bcrypt, Zod, Helmet, CORS, Morgan, dotenv, UUID (v7), Nodemon.

**Frontend:** React, Vite, TailwindCSS, React Router, Monaco Editor, Axios.

## Prerequisites

- **Node.js >= 20** — for running the backend and frontend on the host.
- **Docker + Docker Compose** — provides PostgreSQL, Redis, and Ollama locally (no need to install those individually).
- **Git** — to clone the repository.

> PostgreSQL, Redis, and the default AI provider (Ollama) all run as containers
> via `docker-compose.yml`. You do **not** need to install them on your host.

### Install Docker

- **Windows / macOS:** install **Docker Desktop** from
  <https://www.docker.com/products/docker-desktop/> and make sure it is running.
- **Linux:** install **Docker Engine** and the **Compose plugin**
  (<https://docs.docker.com/engine/install/>), then verify:

```bash
docker --version
docker compose version
```

## Local Development Environment

### First-time setup

```bash
# 1. Copy environment templates (defaults already match docker-compose.yml)
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. Start the infrastructure (PostgreSQL, Redis, Ollama)
docker compose up -d

# 3. Pull the default AI model (one-time; enables AI compile-error help)
docker exec -it judgex-ollama ollama pull llama3

# 4. Install application dependencies (run when you begin implementation)
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

See [`docker/README.md`](docker/README.md) for container details, ports,
volumes, startup order, and troubleshooting.

### Start services

```bash
docker compose up -d
```

### Stop services

```bash
# Stop and remove containers (data is preserved in named volumes)
docker compose down

# Stop but keep containers (faster restart)
docker compose stop
```

> Dependencies are declared in `backend/package.json` and `frontend/package.json` but are **not** yet installed. Run `npm install` in each package when you begin implementation.

## Runs Fully Free

The default AI provider is local **Ollama** (no API key, no paid services). PostgreSQL, Redis, BullMQ, Docker, React, and Express are all open-source. OpenAI is an optional, config-enabled provider.

> This repository currently contains the **project scaffold** (placeholder files + dependency manifests). Implementation follows the phased roadmap in `docs/PRD.md`.
