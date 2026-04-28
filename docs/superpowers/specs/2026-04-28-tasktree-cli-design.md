# TaskTree CLI — Agent-Native CLI Design

> Date: 2026-04-28
> Status: Approved

## Overview

A Python CLI tool wrapping the TaskTree REST API, built with CLI-Anything framework (Click). Designed for AI agent fluency: `--json` on all commands, text tree output, batch operations, REPL mode with session state.

## Installation

```bash
pip install git+https://github.com/borankux/tasktree.git#subdirectory=tasktree/agent-harness
```

Or locally:

```bash
cd tasktree/agent-harness && pip install -e .
```

Runs as `tasktree` command.

## Configuration

**Config location**: `~/.tasktree/`

```
~/.tasktree/
├── config.json       # {"server": "https://tasktree.tohsun.com"}
└── auth.json         # {"token": "...", "user": {...}, "expires_at": epoch}
```

**Config sources** (priority order):
1. CLI flags (`--server`, `--token`)
2. Environment variables (`TASKTREE_SERVER`, `TASKTREE_TOKEN`)
3. Config files (`~/.tasktree/config.json`, `~/.tasktree/auth.json`)

## Authentication

### `tasktree login`

```bash
tasktree login                           # interactive: prompts username + password
tasktree login -u mirzat -p mirzat       # non-interactive
tasktree login --server https://tasktree.tohsun.com
```

Behavior:
1. POST `/api/auth/login` with username + password
2. Save token + user to `~/.tasktree/auth.json`
3. Token has no server-side expiry (HMAC-SHA256 JWT), but CLI stores a client-side `expires_at` (default 30 days) for re-login
4. On 401 response anywhere, auto re-login using saved credentials
5. Password stored as hash in keyring (fallback: config file)

### `tasktree me`

```bash
tasktree me           # show current user
tasktree me --json    # {"user": {"id": "...", "username": "mirzat"}}
```

## Command Reference

### Projects

```bash
tasktree projects                          # list projects
tasktree projects --json                   # JSON output
tasktree projects create <name>            # create project
tasktree projects get <id>                 # get project + all nodes + edges
tasktree projects get <id> --json          # full JSON dump
tasktree projects get <id> --format tree   # indented text tree
tasktree projects delete <id>              # delete project
```

### Nodes

```bash
tasktree nodes list --project <id>                     # list all nodes
tasktree nodes list --project <id> --json
tasktree nodes create --project <id> --title "Title"   # create node under root
tasktree nodes create --project <id> --title "Title" --parent <parent-id>
tasktree nodes update <id> [--title t] [--notes n] [--status s] [--edge-label l]
tasktree nodes update <id> --status done               # mark done
tasktree nodes delete <id>
tasktree nodes move <id> --parent <new-parent-id>      # move to new parent
tasktree nodes reorder <id> --order <n>
```

### Edges

```bash
tasktree edges list --project <id>
tasktree edges create --project <id> --source <id> --target <id> [--label "depends on"]
tasktree edges update <id> [--label "new label"]
tasktree edges delete <id>
```

### Layout

```bash
tasktree layout <project-id>              # trigger auto-layout, return updated nodes
tasktree layout <project-id> --json
```

### AI-Optimized Commands

#### `tree` — Text Tree Output

```bash
tasktree tree <project-id>
```

Output:

```
Root Node (active)
├── Design Phase (active)
│   ├── UI Mockups (done)
│   └── API Design (pending)
├── Development (pending)
│   ├── Frontend (pending)
│   └── Backend (pending)
└── Testing (dropped)
```

Status colors in terminal: active=green, done=blue, dropped=red, pending=gray.

#### `search` — Fuzzy Search

```bash
tasktree search <project-id> --query "design"
```

Output matching nodes with full path:

```
Found 2 nodes:
  1. "UI Mockups" (done) → Root > Design Phase > UI Mockups
  2. "API Design" (pending) → Root > Design Phase > API Design
```

#### `batch` — Batch Operations from JSON

```bash
tasktree batch --file operations.json
```

Input format:

```json
{
  "project_id": "abc-123",
  "operations": [
    {"action": "create_node", "title": "Phase 1", "parent_id": "root-id"},
    {"action": "create_node", "title": "Phase 2", "parent_id": "root-id"},
    {"action": "update_node", "id": "node-1", "status": "done"},
    {"action": "create_edge", "source_id": "node-1", "target_id": "node-2", "label": "blocks"},
    {"action": "delete_node", "id": "node-3"}
  ]
}
```

Output:

```
5/5 operations completed.
  Created: Phase 1 (node-new-1)
  Created: Phase 2 (node-new-2)
  Updated: node-1 → status=done
  Created edge: node-1 → node-2
  Deleted: node-3
```

Batch executes operations in order. If one fails, stop and report which operation failed.

## REPL Mode

Running `tasktree` with no subcommand enters REPL mode:

```
$ tasktree
TaskTree CLI v1.0 (mirzat @ tasktree.tohsun.com)

tasktree> use abc-123
  Project: My Project

tasktree:My Project> tree
  Root Node (active)
  ├── Child A (done)
  └── Child B (pending)

tasktree:My Project> nodes create --title "New task"
  Created: New task (node-xyz)

tasktree:My Project> nodes update node-xyz --status active
  Updated: New task → active

tasktree:My Project> exit
```

REPL session state:
- `current_project`: set by `use <id>`, inherited by subsequent commands
- Commands in REPL omit `--project` flag when `current_project` is set
- Prompt shows current project name

## Package Structure

```
tasktree/
└── agent-harness/
    ├── TASKTREE.md              # API reference (CLI-Anything standard)
    ├── setup.py                 # package definition, entry_points
    └── cli_anything/
        └── tasktree/
            ├── __init__.py
            ├── __main__.py      # python -m cli_anything.tasktree
            ├── tasktree_cli.py  # Click group + REPL loop
            ├── auth.py          # login, token cache, auto-refresh
            ├── client.py        # HTTP client wrapping all API endpoints
            ├── commands/
            │   ├── __init__.py
            │   ├── projects.py  # projects subgroup
            │   ├── nodes.py     # nodes subgroup
            │   ├── edges.py     # edges subgroup
            │   ├── layout.py    # layout command
            │   ├── tree.py      # tree display command
            │   ├── search.py    # search command
            │   └── batch.py     # batch operations
            ├── formatters.py    # JSON / tree / flat / table formatters
            └── utils.py         # config read/write, path resolution
```

## Dependencies

- `click>=8.0` — CLI framework
- `requests>=2.28` — HTTP client
- `rich>=13.0` — terminal formatting (tree display, colors)

No other external dependencies. Standard library for config (json, os, pathlib).

## Target Server

Default: `https://tasktree.tohsun.com`

All API endpoints are under `/api/` prefix. Full endpoint list:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/login | No | Login |
| POST | /api/auth/register | No | Register (disabled in UI) |
| GET | /api/auth/me | Yes | Current user |
| GET | /api/projects | Yes | List projects |
| POST | /api/projects | Yes | Create project |
| GET | /api/projects/:id | Yes | Get project with nodes+edges |
| DELETE | /api/projects/:id | Yes | Delete project |
| POST | /api/nodes | Yes | Create node |
| PATCH | /api/nodes/:id | Yes | Update node |
| PATCH | /api/nodes/:id/position | Yes | Update position |
| DELETE | /api/nodes/:id | Yes | Delete node |
| POST | /api/nodes/:id/reorder | Yes | Reorder node |
| POST | /api/projects/:id/layout | Yes | Auto-layout |
| POST | /api/edges | Yes | Create edge |
| PATCH | /api/edges/:id | Yes | Update edge |
| DELETE | /api/edges/:id | Yes | Delete edge |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Auth error (not logged in / token expired) |
| 3 | API error (server returned non-2xx) |
| 4 | Validation error (missing required args) |
