# AGENTS.md - Backend

## Project Overview

Node.js application built with Express, Drizzle ORM, and PostgreSQL.
It serves as the API for the Northwind application, featuring Clerk authentication middleware, ImageKit file uploads, standard webhooks, and Stream chat integration.

## Setup Commands

- Install dependencies: `npm install`
- Start development server (with `tsx` hot reload): `npm run dev`
- Build for production (TypeScript to JS): `npm run build`
- Start production server: `npm run start`

## Database Workflow

Drizzle ORM is used for database modeling and migrations.
- **Sync schema to DB:** `npm run db:push`
- **Seed initial data:** `npm run db:seed`
- Note: Both require a valid `.env` with a proper database connection string.

## Code Style & Linting

- **Linting:** Run `npm run lint` to check for errors. Run `npm run lint:fix` to auto-fix issues.
- **TypeScript:** Strict typing is enforced. Avoid `any` types.
- **Imports:** Import sorting is enforced via `eslint-plugin-simple-import-sort`.
- **Validation:** Use `zod` for validating request bodies and query parameters.

## Development Guidelines

- **Always run commands from within the `backend/` directory.**
- When modifying database schemas (in `drizzle-orm` models), always run `npm run db:push` to sync changes with your local database before testing.
- Utilize the existing Sentry setup for logging and error monitoring where applicable.
