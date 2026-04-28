# TaskTree CLI

Agent-native CLI for TaskTree — a personal tree-based task management app.

## Installation

    pip install git+https://github.com/borankux/tasktree.git#subdirectory=tasktree/agent-harness

Or locally:

    cd tasktree/agent-harness && pip install -e .

## Quick Start

    tasktree login -u <username> -p <password>
    tasktree projects list
    tasktree projects create "My Project"
    tasktree tree <project-id>

## Commands

### Auth
- `tasktree login` — Login and cache token
- `tasktree me` — Show current user

### Projects
- `tasktree projects list` — List projects
- `tasktree projects create <name>` — Create project
- `tasktree projects get <id>` — Get project details
- `tasktree projects delete <id>` — Delete project

### Nodes
- `tasktree nodes list -p <id>` — List nodes
- `tasktree nodes create -p <id> -t "Title"` — Create node
- `tasktree nodes update <id> [--status done]` — Update node
- `tasktree nodes delete <id>` — Delete node
- `tasktree nodes move <id> --parent <id>` — Move node
- `tasktree nodes reorder <id> --order <n>` — Reorder

### Edges
- `tasktree edges list -p <id>` — List edges
- `tasktree edges create -p <id> -s <id> -t <id>` — Create edge
- `tasktree edges update <id> -l "label"` — Update edge
- `tasktree edges delete <id>` — Delete edge

### Layout
- `tasktree layout <project-id>` — Auto-layout

### AI Commands
- `tasktree tree <project-id>` — Text tree output
- `tasktree search <project-id> -q "query"` — Search nodes
- `tasktree batch -f ops.json` — Batch operations

### REPL
- `tasktree` — Enter interactive REPL
- `use <project-id>` — Set current project context
- `exit` — Exit REPL

## Flags
- `--json` — Machine-readable JSON output (all commands)
- `--format tree|json|flat` — Output format (projects get)

## Configuration
- Config: `~/.tasktree/config.json`
- Auth: `~/.tasktree/auth.json`
- Env: `TASKTREE_SERVER`, `TASKTREE_TOKEN`

## Exit Codes
- 0: Success
- 1: General error
- 2: Auth error
- 3: API error
- 4: Validation error
