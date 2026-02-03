# Session Replay Frontend

Frontend application for Claude Code Session Replay built with React, TypeScript, and Vite.

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **TanStack Query** - Data fetching and caching
- **TanStack Virtual** - Virtualized lists for performance

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server (runs on http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Project Structure

```
src/
├── api/          # API client and data fetching
├── components/   # React components
├── hooks/        # Custom React hooks
├── stores/       # Zustand state stores
├── types/        # TypeScript type definitions
├── App.tsx       # Main app component
├── main.tsx      # Entry point
└── index.css     # Global styles
```

## API Proxy

The Vite dev server is configured to proxy API requests to the backend:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001`
- Requests to `/api/*` are automatically proxied to the backend
