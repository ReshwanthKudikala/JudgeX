# =========================================================================
# JudgeX Backend — DEVELOPMENT Dockerfile
# Purpose: reproducible dev runtime for the API / judge workers.
# This image is intentionally NOT a production build:
#   - installs ALL dependencies (incl. devDeps like nodemon)
#   - expects the source to be bind-mounted for live reload
#   - does not copy/package application source (no COPY . .)
# =========================================================================

FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching.
# Only manifests are copied; actual source is bind-mounted at runtime.
COPY package.json ./
RUN npm install

# API port (matches PORT in backend/.env.example).
EXPOSE 4000

# Live-reload dev server. Source is mounted over /app by the developer, e.g.:
#   docker run --rm -it -v "$PWD:/app" -v /app/node_modules -p 4000:4000 judgex-backend-dev
CMD ["npm", "run", "dev"]
