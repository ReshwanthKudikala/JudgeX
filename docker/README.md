# JudgeX — Docker Development Infrastructure

This directory documents the local development infrastructure defined in the
root [`docker-compose.yml`](../docker-compose.yml). The compose stack brings up
only the **stateful backing services** JudgeX depends on. The backend API,
judge workers, and frontend run on your **host machine** during development and
connect to these containers over `localhost`.

> **Production:** for a full stack (API + workers + Postgres + Redis) see
> [`docker-compose.prod.yml`](../docker-compose.prod.yml) and the Production
> Deployment section in the root [`README.md`](../README.md).

> Design sources of truth: `docs/ARCHITECTURE.md`, `docs/DATABASE_DESIGN.md`,
> `docs/BACKEND_STRUCTURE.md`.

---

## Language sandbox images

Prebuilt judge sandboxes (required for real judging on host Docker or prod):

```bash
docker build -t judgex-python ./images/python
docker build -t judgex-cpp ./images/cpp
```

---

## Containers

| Service | Image | Role |
|---|---|---|
| **postgres** | `postgres:17-alpine` | Durable source of truth — users, problems, test cases, submissions, results (`DATABASE_DESIGN.md`). |
| **redis** | `redis:7-alpine` | Triple role: BullMQ queue backing store, cache, and rate-limit counters (`ARCHITECTURE.md §6`). AOF persistence enabled. |
| **ollama** | `ollama/ollama:latest` | Default **local, free** AI provider for compile-error explanations (`ARCHITECTURE.md §9.1`). No API key required. |

---

## Exposed Ports

| Service | Host Port | Container Port | Connect via |
|---|---|---|---|
| postgres | `5432` | `5432` | `postgres://judgex:judgex@localhost:5432/judgex` |
| redis | `6379` | `6379` | `redis://localhost:6379` |
| ollama | `11434` | `11434` | `http://localhost:11434` |

These match the defaults in `backend/.env.example` (`DATABASE_URL`,
`REDIS_URL`, `OLLAMA_BASE_URL`), so the backend is **automatically usable**
against this stack with no extra configuration.

---

## Persistent Volumes

Data survives `docker compose down` and container restarts (removed only with
`down -v`).

| Volume | Mounted at | Purpose |
|---|---|---|
| `pgdata` | `/var/lib/postgresql/data` | PostgreSQL data files |
| `redisdata` | `/data` | Redis AOF/RDB persistence |
| `ollamadata` | `/root/.ollama` | Downloaded Ollama models (avoids re-pulling) |

---

## Startup Order & Health Checks

There is no hard dependency between the three services, so they start in
parallel. Each has a health check; treat the stack as "ready" only when all
report `healthy`:

- **postgres** → `pg_isready -U judgex -d judgex`
- **redis** → `redis-cli ping` (expects `PONG`)
- **ollama** → `ollama list`

The backend should be started **after** all three are `healthy`. On first run,
Ollama also needs a model pulled before AI features work:

```bash
docker exec -it judgex-ollama ollama pull llama3
```

Check status at any time:

```bash
docker compose ps
```

---

## Troubleshooting

- **Port already in use (`5432/6379/11434`)**
  Another local Postgres/Redis/Ollama is running. Stop it, or change the host
  side of the port mapping in `docker-compose.yml` (e.g. `"5433:5432"`) and
  update `backend/.env`.

- **Postgres stuck / won't accept connections**
  Wait for the health check to pass (`docker compose ps`). If it fails after a
  bad shutdown, inspect logs: `docker compose logs postgres`.

- **Redis data not persisting**
  Persistence is via AOF (`--appendonly yes`) into the `redisdata` volume. If
  you ran `docker compose down -v`, the volume was deleted — that's expected.

- **Ollama returns 404 / model not found**
  Pull the model first: `docker exec -it judgex-ollama ollama pull llama3`.
  Verify with `curl http://localhost:11434/api/tags`.

- **Ollama is slow / high memory on first request**
  The model loads into memory on first use; subsequent requests are faster.

- **Reset everything (destructive — wipes all data & models)**

```bash
docker compose down -v
```

- **Stale containers after editing compose**

```bash
docker compose up -d --force-recreate
```
