# JudgeX Frontend

React 19 + Vite + TypeScript SPA for JudgeX. Dark LeetCode-inspired UI shell with auth infrastructure, routing, layouts, and a reusable component kit.

## Stack

- React 19, Vite, TypeScript
- TailwindCSS (dark theme only)
- React Router
- TanStack Query
- Axios
- React Hook Form + Zod
- Zustand
- Monaco Editor dependency installed but **not used** yet

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

App: `http://localhost:5173`  
API base (default): `http://localhost:4000/api/v1`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production bundle |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production build |

## Structure

See root README / Sprint 19 deliverable notes. Feature folders under `src/features/*` hold domain UI; shared primitives live in `src/components/ui`.
