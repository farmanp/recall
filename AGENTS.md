# Repository Guidelines

## Project Structure & Module Organization

- `backend/`: Express + TypeScript API, SQLite access, parsers, and routes under `backend/src/`.
- `frontend/`: React + Vite + TypeScript UI. Core code in `frontend/src/` (`pages/`, `components/`, `api/`, `types/`).
- `shared/`: Shared types (planned; keep additions minimal and coordinated).
- `docs/`: Architecture, API examples, and development guides.
- Root scripts: `validate_timeline.js`, `test-api-client.js` for validation and API checks.

## Build, Test, and Development Commands

- `npm install`: Install root dependencies.
- `npm run build`: Build backend + frontend.
- `npm start`: Start the production server (serves UI + API).
- `cd backend && npm run dev`: API dev server with hot reload on port `3001`.
- `cd backend && npm test`: Run backend tests (Vitest).
- `cd frontend && npm run dev`: Start Vite dev server with API proxy.
- `cd frontend && npm run lint`: Run ESLint.
- `node validate_timeline.js [session_id]`: Validate timeline ordering logic.

## Coding Style & Naming Conventions

- TypeScript strict mode with explicit types; avoid `any`.
- Prefer named exports; keep files focused.
- File names: `kebab-case.ts`. Functions: `camelCase`. Types: `PascalCase`.
- Constants: `UPPER_SNAKE_CASE`. Private helpers: `_prefix`.
- Add JSDoc for exported functions in backend modules.

## Testing Guidelines

- Framework: Vitest (backend).
- Test location: `backend/src/__tests__/`.
- Naming: `*.test.ts`.
- Run `npm test` in `backend/` for unit tests; run `node validate_timeline.js` for ordering checks.

## Commit & Pull Request Guidelines

- Commit messages follow Conventional Commits, e.g. `feat(api): add filter`.
- Branch naming: `feature/…`, `fix/…`, `docs/…`, `refactor/…`.
- PRs should include: concise description, testing notes, and screenshots for UI changes.
- Before PR: run backend build, validate timeline, and update docs if APIs change.

## Configuration & Security Notes

- Backend env lives in `backend/.env` (e.g., `PORT=3001`).
- The app reads local session files; never expose it publicly or commit sensitive data.
