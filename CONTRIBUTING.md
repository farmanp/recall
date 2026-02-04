# Contributing to Recall

Thank you for your interest in contributing to Recall! This guide will help you get started with development.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Running the Application](#running-the-application)
- [Code Style Guidelines](#code-style-guidelines)
- [Git Workflow](#git-workflow)
- [Adding New Features](#adding-new-features)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)

---

## Development Setup

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18+** (tested with v22.14.0)
- **npm** (comes with Node.js)
- **Session files** from at least one supported AI coding agent:
  - Claude Code: `~/.claude/projects/`
  - Codex CLI: `~/.codex/sessions/`
  - Gemini CLI: `~/.gemini/tmp/`

### Initial Setup

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd recall
   ```

2. **Install root dependencies:**

   ```bash
   npm install
   ```

3. **Install backend dependencies:**

   ```bash
   cd backend
   npm install
   ```

4. **Install frontend dependencies (when available):**

   ```bash
   cd frontend
   npm install
   ```

5. **Verify session files exist:**

   ```bash
   # Check for Claude Code sessions
   ls ~/.claude/projects/

   # Or check for Codex CLI sessions
   ls ~/.codex/sessions/

   # Or check for Gemini CLI sessions
   ls ~/.gemini/tmp/
   ```

   If any of these directories contain session files, you're ready to go!

---

## Project Structure

```
recall/
├── backend/                 # Express + TypeScript API
│   ├── src/
│   │   ├── db/
│   │   │   ├── connection.ts    # SQLite cache connection
│   │   │   └── schema.ts        # TypeScript types
│   │   ├── parser/
│   │   │   ├── agent-detector.ts  # Detect agent type from path
│   │   │   ├── base-parser.ts     # Abstract base parser
│   │   │   ├── claude-parser.ts   # Claude Code parser
│   │   │   ├── codex-parser.ts    # Codex CLI parser
│   │   │   ├── gemini-parser.ts   # Gemini CLI parser
│   │   │   ├── parser-factory.ts  # Parser selection
│   │   │   └── session-indexer.ts # Session discovery
│   │   ├── routes/
│   │   │   ├── sessions.ts      # Session API routes
│   │   │   └── work-units.ts    # Work unit API routes
│   │   ├── services/
│   │   │   └── work-unit-service.ts # Work unit logic
│   │   ├── server.ts            # Express app setup
│   │   └── index.ts             # Server entry point
│   ├── dist/                    # Compiled JavaScript (generated)
│   ├── package.json
│   └── tsconfig.json
├── frontend/                # React + Vite (in progress)
│   ├── src/
│   │   ├── api/                 # API client
│   │   └── hooks/               # React hooks
│   └── package.json
├── docs/                    # Documentation
│   ├── PHASE_0_RESULTS.md       # Validation results
│   ├── ARCHITECTURE.md          # System architecture
│   ├── API_EXAMPLES.md          # API usage examples
│   ├── DEVELOPMENT_GUIDE.md     # Developer guide
│   └── QUICK_START.md           # Quick start guide
├── shared/                  # Shared types (planned)
├── validate_timeline.js     # Timeline validation script
├── package.json             # Root dependencies
└── README.md                # Main documentation
```

---

## Running the Application

### Backend Server

**Development mode (with hot reload):**

```bash
cd backend
npm run dev
```

The server will start on `http://localhost:3001` and automatically restart when you make changes to `.ts` files.

**Production build:**

```bash
cd backend
npm run build    # Compile TypeScript
npm start        # Run compiled code
```

**Environment Variables:**

Create a `.env` file in the `backend/` directory if needed:

```env
PORT=3001
NODE_ENV=development
```

### Frontend (When Available)

```bash
cd frontend
npm run dev      # Start Vite dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Running Validation Script

Test the timeline ordering algorithm:

```bash
# Validate most recent session
node validate_timeline.js

# Validate specific session
node validate_timeline.js <session_id>
```

---

## Code Style Guidelines

### TypeScript

We use **strict TypeScript** settings for type safety:

```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noImplicitReturns": true,
  "noUncheckedIndexedAccess": true
}
```

**Best Practices:**

1. **Use explicit types** for function parameters and return values
2. **Avoid `any`** - use `unknown` if type is truly unknown
3. **Use interfaces** for object shapes
4. **Export types** for API contracts
5. **Handle null/undefined** explicitly

**Example:**

```typescript
// Good
export function getSessionById(sessionId: string): Session | null {
  const session = db.prepare('...').get(sessionId) as Session | undefined;
  return session || null;
}

// Bad
export function getSessionById(sessionId: any) {
  return db.prepare('...').get(sessionId);
}
```

### Code Organization

1. **Group imports logically:**

   ```typescript
   // External dependencies
   import express from 'express';
   import cors from 'cors';

   // Internal modules
   import { getDbInstance } from './db/connection';
   import type { Session } from './db/schema';
   ```

2. **Use named exports** (not default exports) for consistency
3. **Keep files focused** - one responsibility per file
4. **Extract helper functions** into separate files when they're reusable

### Naming Conventions

- **Files:** `kebab-case.ts` (e.g., `session-queries.ts`)
- **Functions:** `camelCase` (e.g., `getSessionById`)
- **Types/Interfaces:** `PascalCase` (e.g., `SessionEvent`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `DB_PATH`)
- **Private functions:** Prefix with `_` (e.g., `_parseJSON`)

### Documentation

1. **Add JSDoc comments** for all exported functions:

   ```typescript
   /**
    * Get session timeline events with TIME-FIRST ordering
    * @param sessionId - Claude session UUID
    * @param query - Filter and pagination options
    * @returns Events array with total count
    */
   export function getSessionEvents(
     sessionId: string,
     query: SessionEventsQuery
   ): { events: SessionEvent[]; total: number } {
     // ...
   }
   ```

2. **Document complex logic** with inline comments
3. **Update README.md** when adding major features

---

## Git Workflow

### Branch Naming

- **Feature:** `feature/add-search-filter`
- **Bug fix:** `fix/timeline-ordering-bug`
- **Documentation:** `docs/update-api-examples`
- **Refactor:** `refactor/extract-db-utils`

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**

```bash
git commit -m "feat(api): add observation type filtering"
git commit -m "fix(timeline): correct timestamp ordering logic"
git commit -m "docs(readme): update quick start instructions"
```

### Workflow Steps

1. **Create a feature branch:**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and commit frequently:

   ```bash
   git add src/db/queries.ts
   git commit -m "feat(db): add getProjects query"
   ```

3. **Keep your branch up to date:**

   ```bash
   git fetch origin
   git rebase origin/main
   ```

4. **Push your branch:**

   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open a pull request** on GitHub

---

## Adding New Features

### Adding a New API Endpoint

1. **Define types** in `backend/src/db/schema.ts`:

   ```typescript
   export interface NewFeatureQuery {
     param1?: string;
     param2?: number;
   }
   ```

2. **Add database query** in `backend/src/db/queries.ts`:

   ```typescript
   export function getNewFeature(query: NewFeatureQuery): Result {
     const db = getDbInstance();
     // Implement query
   }
   ```

3. **Add route handler** in `backend/src/routes/sessions.ts` (or new route file):

   ```typescript
   router.get('/new-feature', (req: Request, res: Response) => {
     // Handle request
   });
   ```

4. **Test the endpoint:**

   ```bash
   curl http://localhost:3001/api/new-feature
   ```

5. **Document in API_EXAMPLES.md**

### Adding a New Database Query

1. **Validate SQL** using the validation script first:

   ```bash
   node validate_timeline.js
   ```

2. **Use parameterized queries** to prevent SQL injection:

   ```typescript
   // Good
   db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);

   // Bad
   db.prepare(`SELECT * FROM sessions WHERE id = ${id}`).get();
   ```

3. **Handle JSON fields** properly:
   ```typescript
   function parseJSONField(field: string): string[] | undefined {
     try {
       const parsed = JSON.parse(field);
       return Array.isArray(parsed) ? parsed : undefined;
     } catch {
       return undefined;
     }
   }
   ```

### Adding Frontend Components (When Available)

1. **Create component** in `frontend/src/components/`
2. **Add types** for props
3. **Use React hooks** from `frontend/src/hooks/`
4. **Test in browser** before committing

---

## Testing

### Manual Testing

1. **Start the backend server:**

   ```bash
   cd backend && npm run dev
   ```

2. **Test API endpoints:**

   ```bash
   # Health check
   curl http://localhost:3001/api/health

   # List sessions
   curl 'http://localhost:3001/api/sessions?limit=5'

   # Get session details
   curl http://localhost:3001/api/sessions/<session_id>
   ```

3. **Run validation script:**
   ```bash
   node validate_timeline.js
   ```

### Automated Testing (Planned)

We use **Vitest** for testing (framework already installed):

```bash
cd backend
npm test              # Run tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

**Test file location:** `backend/src/__tests__/`

---

## Pull Request Process

### Before Submitting

1. **Run validation script** to ensure timeline logic is correct:

   ```bash
   node validate_timeline.js
   ```

2. **Test API endpoints** manually:

   ```bash
   curl http://localhost:3001/api/health
   ```

3. **Build the project** to catch TypeScript errors:

   ```bash
   cd backend && npm run build
   ```

4. **Update documentation** if you've changed APIs or added features

### PR Checklist

- [ ] Code follows style guidelines
- [ ] All TypeScript type errors resolved
- [ ] Validation script passes
- [ ] API endpoints tested manually
- [ ] Documentation updated (README, API_EXAMPLES, etc.)
- [ ] Commit messages follow conventions
- [ ] No sensitive data (API keys, credentials) in code

### PR Description Template

```markdown
## Description

Brief description of what this PR does.

## Changes

- Added X feature
- Fixed Y bug
- Refactored Z module

## Testing

- [ ] Tested API endpoint manually
- [ ] Ran validation script
- [ ] Built project successfully

## Screenshots (if applicable)

Add screenshots for UI changes.
```

---

## Common Issues

### No Sessions Found

**Problem:** The application shows no sessions

**Solution:**

1. Ensure you have recorded sessions from at least one supported agent
2. Run Claude Code, Codex CLI, or Gemini CLI to create some sessions
3. Verify session files exist:
   ```bash
   ls ~/.claude/projects/      # Claude Code
   ls ~/.codex/sessions/       # Codex CLI
   ls ~/.gemini/tmp/           # Gemini CLI
   ```

### TypeScript Compilation Errors

**Problem:** Type errors when building

**Solution:**

1. Check `tsconfig.json` settings
2. Run `npm install` to ensure all `@types/*` packages are installed
3. Use explicit type annotations

### Port Already in Use

**Problem:** `EADDRINUSE: address already in use :::3001`

**Solution:**

```bash
# Find process using port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>
```

Or change the port in `.env`:

```env
PORT=3002
```

---

## Getting Help

- **Issues:** Open an issue on GitHub
- **Questions:** Check existing documentation in `docs/`
- **Discussion:** Start a discussion on GitHub Discussions

---

## License

MIT License (or your preferred license)

---

**Thank you for contributing!**
