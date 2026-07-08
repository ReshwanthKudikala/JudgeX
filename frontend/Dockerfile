# =========================================================================
# JudgeX Frontend — DEVELOPMENT Dockerfile
# Purpose: reproducible dev runtime for the Vite dev server.
# Development-only:
#   - installs ALL dependencies (incl. devDeps: vite, tailwind, plugins)
#   - expects the source to be bind-mounted for hot module replacement (HMR)
#   - does NOT build/package a production bundle
# =========================================================================

FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json ./
RUN npm install

# Vite dev server port.
EXPOSE 5173

# --host binds to 0.0.0.0 so the dev server is reachable from the host.
# Bind-mount source at runtime, e.g.:
#   docker run --rm -it -v "$PWD:/app" -v /app/node_modules -p 5173:5173 judgex-frontend-dev
CMD ["npm", "run", "dev", "--", "--host"]
