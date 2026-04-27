# MindMap Task Manager - Design Spec

## Overview

A personal, tree-based task management application built on an infinite canvas. Instead of linear lists or kanban boards, tasks are organized as a mind map / tree structure where branches represent different approaches, domains, or sub-tasks. Users can fork paths, backtrack, and visually track progress through color-coded node states.

**Target user**: Solo (Frank), no auth, no multi-user.

## Data Model

### projects

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (PK) | UUID |
| name | TEXT | Project name |
| created_at | TEXT | ISO timestamp |

### nodes

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (PK) | UUID |
| project_id | TEXT (FK) | References projects.id |
| parent_id | TEXT (FK, nullable) | References nodes.id. NULL = root node |
| title | TEXT | Node title |
| notes | TEXT | Detailed notes, default empty |
| status | TEXT | `pending` \| `active` \| `done` \| `dropped` |
| position_x | REAL | Canvas X coordinate |
| position_y | REAL | Canvas Y coordinate |
| sort_order | INTEGER | Order among siblings |
| created_at | TEXT | ISO timestamp |

Key points:
- One tree = one project. The root node (parent_id = NULL) is the project's core goal.
- position_x/y stores canvas position; updated on drag. New nodes get auto-calculated positions via elkjs layout.
- Status colors: pending (gray), active (yellow), done (green), dropped (red).
- Implicit forking: no special "branch" concept. Just add child nodes freely, use status to mark which paths were taken or abandoned.

## API Design

All endpoints return JSON. No authentication.

### Projects

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/projects | List all projects |
| POST | /api/projects | Create project (auto-creates root node) |
| GET | /api/projects/:id | Get project with all nodes |
| DELETE | /api/projects/:id | Delete project and all nodes |

### Nodes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/nodes | Create node (specify parent_id) |
| PATCH | /api/nodes/:id | Update title/notes/status |
| PATCH | /api/nodes/:id/position | Update canvas coordinates after drag |
| DELETE | /api/nodes/:id | Delete node and all descendants |
| POST | /api/nodes/:id/reorder | Reorder among siblings |

### Layout

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/projects/:id/layout | Recalculate tree layout coordinates |

Layout uses elkjs to compute tree positions. Returns updated coordinates for all nodes in the project.

## Frontend Architecture

```
src/
├── App.tsx                    — Router: project list / canvas
├── pages/
│   ├── ProjectList.tsx        — Project list (card grid)
│   └── Canvas.tsx             — Main canvas page
├── components/
│   ├── MindMap.tsx            — React Flow canvas wrapper
│   ├── TaskNode.tsx           — Custom node (status color, title, notes icon)
│   ├── NodeEditor.tsx         — Sidebar/modal for editing title and notes
│   └── Toolbar.tsx            — Top bar (layout, zoom, project name)
├── hooks/
│   ├── useTree.ts             — Flat nodes → tree structure + CRUD
│   ├── useLayout.ts           — Call layout API, return coordinates
│   └── useShortcuts.ts        — Keyboard shortcut registration
├── store/
│   └── projectStore.ts        — Zustand: current project, selected node, edit state
└── lib/
    ├── api.ts                 — Fetch wrapper
    └── layout.ts              — elkjs tree layout computation
```

### Interactions

| Action | Trigger |
|--------|---------|
| Create child node | Select node → `Enter` or click `+` button |
| Edit title | Select node → `F2` or double-click |
| Delete node | Select node → `Delete` (confirm if has children) |
| Cycle status | Select node → `1` (pending) / `2` (active) / `3` (done) / `4` (dropped) |
| Pan canvas | Mouse drag on empty area |
| Zoom | Scroll wheel |
| Drag node | Mouse drag on node (visual only, does not change tree structure) |
| Focus subtree | Double-click node — canvas focuses on that subtree, hides other branches |
| Return to overview | `Esc` or toolbar button |

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | React 18 + Vite | Fast dev, good HMR |
| Canvas engine | React Flow 12 | Node+edge model, virtualized rendering, built-in zoom/pan |
| Layout | elkjs | Best tree layout algorithm |
| State | Zustand | Lightweight, right complexity level |
| Styling | Tailwind CSS | Fast UI without style deliberation |
| Backend | Hono | Lighter and more modern than Express, type-safe |
| Database | SQLite (better-sqlite3) | Zero config, sufficient for personal use |
| API style | REST + JSON | Simple and direct |
| Monorepo | pnpm workspace | Shared types between frontend and backend |

## Project Structure

```
plans/
├── package.json               — pnpm workspace root
├── apps/
│   ├── web/                   — React frontend (Vite)
│   └── server/                — Hono backend
└── packages/
    └── shared/                — Shared TypeScript types
```

## Scope (MVP)

In scope:
- Infinite canvas with tree-structured nodes
- Four status states with color coding
- Node title + notes
- Keyboard + mouse hybrid interaction
- Subtree focus / overview toggle
- Auto tree layout with elkjs
- Node drag (visual repositioning)
- Project list

Out of scope (future):
- Kanban view
- Gantt chart view
- Multi-user / auth
- Real-time sync
- Node tags or labels
- Priority / due dates
- Import / export
- Mobile support
