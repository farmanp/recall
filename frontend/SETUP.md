# Frontend Setup Guide

This guide will help you set up the frontend with the API client library.

## Prerequisites

- Node.js 16+ installed
- Backend API running at http://localhost:3001

## Installation Steps

### 1. Initialize the Frontend Project (if not already done)

```bash
cd /Users/fpirzada/Documents/recall/frontend
npm init -y
```

### 2. Install Required Dependencies

```bash
# Core dependencies
npm install react react-dom

# React Query for data fetching
npm install @tanstack/react-query

# TypeScript (if not already installed)
npm install -D typescript @types/react @types/react-dom

# Build tools (choose one):
# Option A: Vite (recommended)
npm install -D vite @vitejs/plugin-react

# Option B: Create React App
# npx create-react-app . --template typescript

# Option C: Next.js
# npx create-next-app@latest . --typescript
```

### 3. TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src", "../shared"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 4. Vite Configuration (if using Vite)

Create `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

### 5. Update package.json Scripts

```json
{
  "name": "claude-session-replay-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "node ../test-api-client.js"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@tanstack/react-query": "^5.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

### 6. Create Main App Entry Point

Create `src/main.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';
import './index.css';

// Create a React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);
```

### 7. Create App Component

Create `src/App.tsx`:

```typescript
import React from 'react';
import { SessionViewerApp } from './examples/SessionViewer.example';

function App() {
  return <SessionViewerApp />;
}

export default App;
```

### 8. Create Index HTML

Create `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Recall</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 9. Create Basic CSS (Optional)

Create `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

## Running the Application

### 1. Start the Backend (in one terminal)

```bash
cd /Users/fpirzada/Documents/recall/backend
npm run dev
```

### 2. Test the API Client (optional)

```bash
cd /Users/fpirzada/Documents/cc_mem_video_player
node test-api-client.js
```

### 3. Start the Frontend (in another terminal)

```bash
cd /Users/fpirzada/Documents/recall/frontend
npm run dev
```

The frontend should now be running at http://localhost:3000

## Environment Variables (Optional)

Create `.env` file in frontend directory:

```env
VITE_API_BASE_URL=http://localhost:3001
```

Update the API client to use this:

```typescript
// In src/api/client.ts
const DEFAULT_CONFIG: Required<ApiClientConfig> = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
  timeout: 30000,
};
```

## Troubleshooting

### CORS Issues

If you encounter CORS errors, make sure the backend has CORS enabled:

```typescript
// In backend server
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
```

### Type Import Errors

If you get errors importing shared types, make sure:
1. TypeScript paths are configured correctly in `tsconfig.json`
2. The `../shared/types.ts` file exists
3. Your build tool supports TypeScript path aliases

### React Query DevTools Not Showing

Install the devtools package:

```bash
npm install -D @tanstack/react-query-devtools
```

## Next Steps

1. Customize the UI components in `SessionViewer.example.tsx`
2. Add more filtering and search capabilities
3. Implement session playback with timeline
4. Add export functionality
5. Add authentication if needed

## File Structure

```
frontend/
├── src/
│   ├── api/
│   │   ├── client.ts          # API client implementation
│   │   └── client.test.ts     # API client tests
│   ├── hooks/
│   │   └── useApi.ts          # React Query hooks
│   ├── examples/
│   │   └── SessionViewer.example.tsx  # Example components
│   ├── App.tsx                # Main app component
│   ├── main.tsx               # Entry point
│   └── index.css              # Styles
├── index.html                 # HTML entry
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript configuration
├── package.json              # Dependencies
└── SETUP.md                  # This file
```

## API Client Features

- ✅ Fully typed with TypeScript
- ✅ Error handling with custom error class
- ✅ Timeout support (configurable)
- ✅ Automatic JSON parsing
- ✅ Query string building
- ✅ React Query integration
- ✅ Auto-refetch for active sessions
- ✅ Pagination support
- ✅ Filtering support
- ✅ Cache management with query keys
