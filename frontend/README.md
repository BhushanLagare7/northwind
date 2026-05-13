# Northwind Frontend

> The React application powering the Northwind e-commerce platform.

This directory contains the frontend code for Northwind, built with React, Vite, and Tailwind CSS. It connects to the Express backend to provide a seamless user experience for managing products, interacting with orders, and participating in real-time chats and video calls.

## Key Technologies

- **[React](https://react.dev/)** & **[Vite](https://vitejs.dev/)**: For fast, modern UI development.
- **[Tailwind CSS](https://tailwindcss.com/)** & **[DaisyUI](https://daisyui.com/)**: For rapid and elegant styling.
- **[React Router](https://reactrouter.com/)**: For client-side routing.
- **[TanStack Query](https://tanstack.com/query/latest)**: For powerful asynchronous state management and data fetching.
- **[Zustand](https://zustand-demo.pmnd.rs/)**: For lightweight global state management.
- **[Clerk](https://clerk.com/)**: For secure user authentication.
- **[Stream](https://getstream.io/)**: For real-time chat and video functionality.

## Getting Started

### Installation

Install the required dependencies using npm:

```bash
npm install
```

### Environment Variables

Configure the required environment variables in a `.env` file at the root of the `frontend` directory. Key variables include your Clerk publishable key, Stream credentials, and the backend API URL.

### Development Server

Start the development server with Hot Module Replacement (HMR):

```bash
npm run dev
```

> [!TIP]
> Make sure the backend server is running concurrently to ensure API requests and authentication flows work correctly.

### Build and Lint

To build the application for production:
```bash
npm run build
```

To run the linter and check for issues:
```bash
npm run lint
```
