# TaskTree — Project Instructions

> This file is auto-loaded by Claude Code. It defines project collaboration rules.

## Project Overview

- **Product:** TaskTree — a personal tree-based task management app on an infinite canvas
- **Stage:** v0.1 MVP in development
- **GitHub:** https://github.com/borankux/tasktree

## Monorepo Structure

```
packages/shared/   → @tasktree/shared — Shared TypeScript types (Node, Project, etc.)
apps/server/       → @tasktree/server — Hono + SQLite backend (port 3001)
apps/web/          → @tasktree/web    — React 18 + Vite frontend (port 5173)
apps/data/         → SQLite database files (gitignored)
```

## Commands

```bash
pnpm dev          # Start both server + web in parallel
pnpm server       # Start backend only (tsx watch)
pnpm web          # Start frontend only (Vite dev server)
pnpm build        # Build all packages
```

Frontend dev server proxies `/api` requests to the backend via Vite config (`apps/web/vite.config.ts`).

## Architecture

### Backend (`apps/server/`)
- **Hono** framework, **better-sqlite3** for SQLite with WAL mode
- `src/db.ts` — DB init + schema migration (runs CREATE TABLE IF NOT EXISTS on startup)
- `src/routes/` — Three Hono sub-routers: `projects.ts`, `nodes.ts`, `layout.ts`
- DB path: `apps/data/tasktree.db` (override with `DB_PATH` env var)
- All API routes are prefixed with `/api/`

### Frontend (`apps/web/`)
- **React 18** + **React Flow 12** (`@xyflow/react`) for the canvas
- **Zustand** store in `src/store/projectStore.ts` — holds projects, nodes, selectedNodeId, editingNodeId, focusNodeId
- Imported by both server and web via `@tasktree/shared` workspace dependency
- **React Router** — two routes: `/` (ProjectList) and `/project/:id` (Canvas)
- `src/lib/api.ts` — typed fetch wrapper consuming `@tasktree/shared` types
- `src/hooks/useTree.ts` — flat nodes → tree conversion + CRUD helpers
- `src/hooks/useLayout.ts` — elkjs layout API integration
- **Tailwind CSS** for styling

### Shared Types (`packages/shared/`)
- `src/types.ts` — `Node`, `Project`, `NodeStatus`, request/response body types
- Imported by both server and web via `@tasktree/shared` workspace dependency

### Data Model
- `projects` table — id, name, created_at
- `nodes` table — id, project_id (FK CASCADE), parent_id (nullable, FK CASCADE), title, notes, status, position_x, position_y, sort_order, created_at
- Root node has `parent_id = NULL`, auto-created when a project is created
- Node deletion cascades to all descendants

### API Endpoints
- `GET/POST /api/projects` — list/create projects
- `GET/DELETE /api/projects/:id` — get (with all nodes) / delete project
- `POST /api/nodes` — create node (requires parent_id)
- `PATCH /api/nodes/:id` — update title/notes/status
- `PATCH /api/nodes/:id/position` — update canvas coordinates after drag
- `DELETE /api/nodes/:id` — delete node + descendants (CASCADE)
- `POST /api/nodes/:id/reorder` — reorder among siblings
- `POST /api/projects/:id/layout` — recalculate tree layout via elkjs

## Language
- **Language:** en

## Project Management System

This project uses a 5-component management system.

### Triggers

| Intent | AI Action |
|--------|-----------|
| End session / wrap up — any expression of "we're done for now" | Write log + update handoff + sync Wiki + check TODO + collect constitution candidates + file reorganization + output summary |
| Review constitution — any expression of "check/update rules" | Show .claude/candidates.md for confirmation one by one |
| Sync wiki — any expression of "update project overview" | Force rescan and update PROJECT.md |
| Check status — any expression of "what's the current state" | Read PROJECT.md + session-handoff.md summary aloud |
| Organize files — any expression of "clean up files" | Scan project files, organize per STRUCTURE.md rules |
| Change language — any expression of "switch language" | Execute Language Change Protocol |

### File Roles

| File | Who writes | When |
|------|-----------|------|
| CLAUDE.md | Human only | review claude trigger |
| PROJECT.md | AI auto | end session + structure changes |
| session-handoff.md | AI auto | end session |
| TODO.md | AI + Human | anytime |
| log/session-*.md | AI | end session |
| .claude/candidates.md | AI auto | when stable rules identified |
| STRUCTURE.md | AI auto | end session + file structure changes |
| .claude/.file-snapshot.json | AI auto | end session |

### Session Start Protocol

At session start, read `PROJECT.md` for project overview, and check the Language setting in CLAUDE.md to determine output language.

### Session End Protocol

When user says "end session" / "wrap up" / "done for today":

1. **Write session log** → `log/session-YYYY-MM-DD-{topic-slug}.md`
2. **Update session-handoff.md** → refresh progress and next steps
3. **Update PROJECT.md** → sync if structure or module status changed
4. **Update TODO.md** → mark completed tasks
5. **Collect constitution candidates** → append to `.claude/candidates.md`
6. **File reorganization (incremental mode)** → only process new/changed files per STRUCTURE.md
7. **Output summary** → brief summary of what was done this session

### Session Log Format

```markdown
# Session YYYY-MM-DD — {topic}

## Session Goal
## Key Actions (Chronological)
## Decisions & Rationale
## Output Files
## Unfinished Items / Next Session Pickup
## CLAUDE.md Candidates (if any)
```

### Constitution Candidate Rules

AI appends entries to `.claude/candidates.md` when:
- User explicitly says "always do this" / "this is a rule" / "never do..."
- The same decision appears across multiple sessions
- Decisions involve naming conventions, file layering, collaboration workflow
- Decisions involve tech stack choices or architecture constraints

**Never edit CLAUDE.md directly.** All candidates must be reviewed by user.

### TODO Format

Every task must include three fields:
```
- [ ] {task description}
  Owner: {name} | Deadline: {date} | Dependencies: {prerequisite}
```
Completed tasks are checked and kept (not deleted) as execution history.

## Coding Guidelines

### 1. Think Before Coding
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them.
- If a simpler approach exists, say so.

### 2. Simplicity First
- No features beyond what was asked.
- No abstractions for single-use code.
- If you write 200 lines and it could be 50, rewrite it.

### 3. Surgical Changes
- Don't "improve" adjacent code, comments, or formatting.
- Match existing style.
- Remove imports/variables/functions that YOUR changes made unused.

### 4. Goal-Driven Execution
- Transform tasks into verifiable goals.
- For multi-step tasks, state a brief plan with verification checkpoints.

## Project-Specific Rules

(Add project-specific rules and preferences here)
