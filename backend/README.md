# Northwind Backend

> The Express API and database service powering the Northwind platform.

This directory contains the Node.js backend for Northwind. It handles data persistence, authentication checks, webhook processing, and integrates with various third-party services to support the frontend application.

## Key Technologies

- **[Express](https://expressjs.com/)**: Fast, unopinionated web framework for Node.js.
- **[Drizzle ORM](https://orm.drizzle.team/)**: Type-safe database interactions with PostgreSQL.
- **[Clerk](https://clerk.com/)**: Authentication middleware and user management.
- **[Polar](https://polar.sh/)**: Payment processing and webhook handling.
- **[Stream](https://getstream.io/)**: Secure backend integration for real-time chat and video routing.
- **[ImageKit](https://imagekit.io/)**: Seamless media storage and image optimization.
- **[Sentry](https://sentry.io/)**: Comprehensive error tracking and performance monitoring.

## Getting Started

### Installation

Install the required dependencies using npm:

```bash
npm install
```

### Environment Variables

Copy the provided example file and update it with your actual credentials:

```bash
cp .env.example .env
```

Ensure you have a running PostgreSQL database and correctly set the database connection string.

### Database Setup

Push the latest Drizzle schema changes to your PostgreSQL database:

```bash
npm run db:push
```

Seed the database with initial required data:

```bash
npm run db:seed
```

### Development Server

Start the backend server in watch mode for development:

```bash
npm run dev
```

> [!IMPORTANT]
> The backend relies on multiple external webhooks (like Clerk and Polar). For local development, you may need a tunneling tool like [ngrok](https://ngrok.com/) to expose your local endpoints to these services.

### Build

To compile the TypeScript code for production:
```bash
npm run build
```
