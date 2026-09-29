# OCOC Frontend (React + TypeScript + Vite)

The frontend web application for the OCOC (One Card · One Campus) University Identity Platform, built with **React 18**, **TypeScript**, **Tailwind CSS**, and **Vite**.

## Tech Stack
- **React 18** with functional components and hooks
- **React Router v6** (`react-router-dom`) with public and protected routing guards
- **Tailwind CSS v4** (`@tailwindcss/vite`)
- **Lucide React** for icons
- **Chart.js** & **react-chartjs-2** for telemetry, trends, and composition charts
- **Axios** with JWT automatic refresh interceptors
- **WebSocket Face Inference** for continuous real-time pose and liveness detection

## Available Scripts

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

## Local API proxy

The Vite development server forwards `/api` requests to the User Management
backend at `http://127.0.0.1:8000` by default. Start the backend from
`user_management/backend` with:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

To use a different backend port, set `VITE_API_TARGET`, for example
`VITE_API_TARGET=http://127.0.0.1:8080 npm run dev`. Restart Vite after changing
the target. The Docker Compose backend continues to expose port 8080.
