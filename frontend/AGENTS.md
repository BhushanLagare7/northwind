# AGENTS.md - Frontend

## Project Overview

React application built with Vite, utilizing React Router (v7), Tailwind CSS (v4), Zustand, and TanStack React Query.
It features integrations with Clerk for authentication and Stream for real-time chat and video functionality.

## Setup Commands

- Install dependencies: `npm install`
- Start development server: `npm run dev`
- Build for production: `npm run build`
- Preview production build locally: `npm run preview`

## Code Style & Linting

- **Linting:** Run `npm run lint` to check for errors. Run `npm run lint:fix` to auto-fix issues.
- **Imports:** Import sorting is enforced via `eslint-plugin-simple-import-sort`.
- **Styling:** Uses Tailwind CSS v4 (via `@tailwindcss/vite`) and DaisyUI component classes.
- **State:** Prefer Zustand for global state management and TanStack Query for server state/data fetching.

## Development Guidelines

- **Always run commands from within the `frontend/` directory.**
- When adding UI components, check if existing DaisyUI classes meet the requirement before writing custom CSS.
- Ensure the backend server (`http://localhost:3000`) is running when testing data fetching or authentication flows locally.
