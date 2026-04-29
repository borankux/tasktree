<div align="center">

# TaskTree

**Tree-based task management on an infinite canvas**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/borankux/tasktree?style=social)](https://github.com/borankux/tasktree/stargazers)
[![Issues](https://img.shields.io/github/issues/borankux/tasktree)](https://github.com/borankux/tasktree/issues)

[Live Demo](https://tasktree.tohsun.com) · [Report Bug](https://github.com/borankux/tasktree/issues/new?template=bug_report.md) · [Request Feature](https://github.com/borankux/tasktree/issues/new?template=feature_request.md)

</div>

---

TaskTree is a personal productivity tool that lets you organize tasks as a visual tree on an infinite canvas. Break down complex projects hierarchically, drag to rearrange, and use XMind-style keyboard shortcuts for fast editing.

## Features

- **Infinite Canvas** — Pan and zoom freely with React Flow
- **Tree Structure** — Hierarchical task breakdown with parent-child relationships
- **Inline Editing** — Click any node to edit its title directly (with IME support)
- **Keyboard Shortcuts** — `Tab` add child, `Enter` add sibling, `Ctrl+L` auto layout, `1-4` set status
- **Auto Layout** — One-click elkjs layered layout (left-to-right tree)
- **Markdown Notes** — Right sidebar with live markdown preview for each task
- **Status Tracking** — 4 status levels with color coding and cascade completion
- **Auth & Data Isolation** — JWT auth with per-user data scoping
- **CLI Tool** — Full-featured Python CLI for agent-native workflows

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Flow 12, Zustand, Tailwind CSS, Vite |
| Backend | Hono, better-sqlite3, elkjs, JWT (HMAC-SHA256) |
| Shared | TypeScript monorepo with shared types |
| CLI | Python Click with Rich formatting |

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 8

### Install & Run

```bash
git clone https://github.com/borankux/tasktree.git
cd tasktree
pnpm install
pnpm dev
```

The app runs at `http://localhost:5173` with the API server on port `3001`.

### Build for Production

```bash
pnpm build
```

## Project Structure

```
packages/shared/   → @tasktree/shared — Shared TypeScript types
apps/server/       → @tasktree/server — Hono + SQLite backend
apps/web/          → @tasktree/web    — React + React Flow frontend
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/projects` | List user's projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project with nodes |
| DELETE | `/api/projects/:id` | Delete project |
| POST | `/api/nodes` | Create node |
| PATCH | `/api/nodes/:id` | Update node |
| DELETE | `/api/nodes/:id` | Delete node + descendants |
| POST | `/api/projects/:id/layout` | Auto layout via elkjs |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Add child node |
| `Enter` | Add sibling node |
| `Ctrl+L` | Auto layout |
| `Delete` / `Backspace` | Delete selected node |
| `1` - `4` | Set status (todo / in-progress / done / blocked) |
| `Esc` | Deselect / Close editor |

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
