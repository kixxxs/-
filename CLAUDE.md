# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start              # Run Electron desktop app
npm run build          # Build Windows installer (NSIS) via electron-builder
node server.js         # Start Express web server on port 3000
node scripts/generate-icon.js  # Generate icon.ico from code (no image lib needed)
```

There is no test suite or linter configured.

## Architecture

**艺人管理系统** — an Electron desktop app for managing artists across ~10 music venue / bar locations. The entire frontend lives in a single file ([src/index.html](src/index.html), ~248KB): inline CSS theme system, vanilla JS UI with modals/tabs/forms, Chart.js dashboards, and Bootstrap 5 components.

### Data flow (Electron)

```
Renderer (src/index.html)
  → window.electronAPI.* (preload.js contextBridge)
    → ipcMain.handle in main.js
      → Database.query/init (db/db/database.js, sql.js WASM SQLite)
```

### Data flow (Web server)

```
Browser → REST API (server.js, Express)
  → server/database.js (better-sqlite3, native SQLite)
  → SSE broadcast on mutations to all connected clients
```

### Database layer (dual implementation)

Both `db/db/database.js` (Electron) and `server/database.js` (Express) implement the same logic — same tables, same seed data, same CRUD operations — but use different SQLite bindings:
- Electron: **sql.js** (WASM, database persisted to disk via `db.export()`)
- Server: **better-sqlite3** (native C++ addon, WAL mode)

Five tables: `stores`, `artists`, `contracts`, `evaluations`, `salaries`. Soft-delete is used for artists (`status = '-1'`). The `DESIRED_STORES` constant (11 store names) drives seed data and store sync.

Server mode adds token-based auth (`/api/login`) and SSE push (`/api/events`) so changes propagate across multiple browser clients in real time. The prebuild script strips `better-sqlite3`, `express`, and `cors` from `node_modules` before packaging (these are optionalDependencies only needed for server mode).

### Key files

| File | Role |
|------|------|
| [main.js](main.js) | Electron main process: window creation, all IPC handlers, DB init |
| [preload.js](preload.js) | Context bridge: exposes `window.electronAPI` |
| [src/index.html](src/index.html) | Entire frontend UI and logic (single file) |
| [db/db/database.js](db/db/database.js) | sql.js database layer (Electron) |
| [server.js](server.js) | Express server with REST API, SSE, auth |
| [server/database.js](server/database.js) | better-sqlite3 database layer (server) |
| [package.json](package.json) | electron-builder config for NSIS Windows installer |

## Behavioral Guidelines (from Andrej Karpathy's observations)

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
