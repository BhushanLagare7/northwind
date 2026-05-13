# AGENTS.md

## Project Overview

Northwind is a full-stack e-commerce web application featuring real-time chat/video (Stream), authentication (Clerk), and payment processing (Polar).

This project is structured as a monorepo consisting of two main components:
- `frontend/`: React + Vite application
- `backend/`: Node.js + Express API

## Monorepo Context

- **Always navigate to the specific package directory (`frontend/` or `backend/`)** before installing dependencies, running scripts, or configuring tooling.
- There is no root-level `package.json`.
- Refer to `frontend/AGENTS.md` for detailed frontend instructions.
- Refer to `backend/AGENTS.md` for detailed backend instructions.

## Development Workflow

1. Ensure a PostgreSQL database is running and accessible.
2. Ensure you have the required `.env` files in both `frontend/` and `backend/` directories with your API keys (Clerk, Stream, Polar, ImageKit).
3. **Backend:** `cd backend && npm install && npm run dev`
4. **Frontend:** `cd frontend && npm install && npm run dev`

## Pull Request Guidelines

- Title format: `[frontend|backend|chore] Brief description`
- Ensure linting passes in both projects before committing:
  - Backend: `cd backend && npm run lint`
  - Frontend: `cd frontend && npm run lint`
