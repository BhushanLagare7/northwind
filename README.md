# Northwind

> A modern full-stack web application featuring product management, real-time order chat/video capabilities, and streamlined checkout.

Northwind is a complete solution that brings together robust e-commerce features with real-time communication. Built with a React frontend and an Express backend, it leverages powerful services like Clerk for authentication, Stream for real-time chat and video, and Polar for payment processing.

## Architecture

The project is structured as a monorepo containing two main parts:

- **Frontend**: A React application built with Vite, Tailwind CSS, and React Router.
- **Backend**: A Node.js API built with Express, Drizzle ORM, and PostgreSQL.

## Features

- **Authentication**: Secure user login and management powered by [Clerk](https://clerk.com/).
- **Real-time Interaction**: Integrated [Stream SDK](https://getstream.io/) for order-specific chat and video calls.
- **Admin Dashboard**: Comprehensive tools to manage products, view orders, and handle file uploads (via ImageKit).
- **Payment Processing**: Webhook integrations with [Polar](https://polar.sh/) for checkout and payment flows.
- **Robust Backend**: Type-safe database queries with Drizzle ORM and robust error handling/monitoring using Sentry.
- **Modern UI**: Styled with Tailwind CSS and DaisyUI, featuring state management via Zustand and data fetching with TanStack Query.

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/en/) (v18 or higher)
- npm, yarn, or pnpm
- A running PostgreSQL database

You will also need accounts and API keys for the following services:
- Clerk
- Stream
- Polar
- ImageKit
- Sentry (optional, for monitoring)

## Getting Started

### 1. Backend Setup

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

Copy the example environment file and update it with your credentials:

```bash
cp .env.example .env
```

Push the database schema and seed initial data:

```bash
npm run db:push
npm run db:seed
```

Start the backend development server:

```bash
npm run dev
```

### 2. Frontend Setup

In a new terminal window, navigate to the frontend directory and install dependencies:

```bash
cd frontend
npm install
```

Configure your environment variables in `.env` with your public API keys (e.g., Clerk publishable key, Stream key).

Start the frontend development server:

```bash
npm run dev
```

> [!NOTE]
> The frontend application will typically be available at `http://localhost:5173` and the backend API at `http://localhost:3000`. Ensure your backend server is running so the frontend can properly fetch data.
