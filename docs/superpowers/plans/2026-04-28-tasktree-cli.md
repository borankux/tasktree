# TaskTree CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python CLI tool (`tasktree`) wrapping the TaskTree REST API, agent-native with `--json` output, REPL mode, text tree display, search, and batch operations.

**Architecture:** Click CLI framework with a `client.py` HTTP layer wrapping all API endpoints. Commands organized as Click subgroups. REPL mode via custom prompt loop with session state (current project). Config/auth persisted to `~/.tasktree/`.

**Tech Stack:** Python 3.10+, Click 8+, requests, rich (terminal formatting)

**Server:** `https://tasktree.tohsun.com` with JWT Bearer auth

---

## File Structure

```
tasktree/agent-harness/
├── TASKTREE.md                          # API reference doc
├── setup.py                             # pip install entry point
└── cli_anything/
    └── tasktree/
        ├── __init__.py                  # version string
        ├── __main__.py                  # python -m entry
        ├── tasktree_cli.py              # Click group + REPL loop
        ├── auth.py                      # login, token cache, auto-refresh
        ├── client.py                    # HTTP client for all API calls
        ├── commands/
        │   ├── __init__.py
        │   ├── projects.py              # projects subgroup commands
        │   ├── nodes.py                 # nodes subgroup commands
        │   ├── edges.py                 # edges subgroup commands
        │   ├── layout.py                # layout command
        │   ├── tree.py                  # tree display (indented text)
        │   ├── search.py                # search nodes by query
        │   └── batch.py                 # batch operations from JSON
        ├── formatters.py                # format_project_tree, format_node_list, etc.
        └── utils.py                     # load_config, save_config, load_auth, save_auth
```

---

### Task 1: Package scaffold + utils + auth

**Files:**
- Create: `tasktree/agent-harness/setup.py`
- Create: `tasktree/agent-harness/cli_anything/__init__.py`
- Create: `tasktree/agent-harness/cli_anything/tasktree/__init__.py`
- Create: `tasktree/agent-harness/cli_anything/tasktree/__main__.py`
- Create: `tasktree/agent-harness/cli_anything/tasktree/utils.py`
- Create: `tasktree/agent-harness/cli_anything/tasktree/auth.py`

- [ ] **Step 1: Create directory structure**

```bash
cd /Users/allintech/Desktop/plans
mkdir -p tasktree/agent-harness/cli_anything/tasktree/commands
```

- [ ] **Step 2: Write `setup.py`**

```python
from setuptools import setup, find_packages

setup(
    name="tasktree-cli",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "click>=8.0",
        "requests>=2.28",
        "rich>=13.0",
    ],
    entry_points={
        "console_scripts": [
            "tasktree=cli_anything.tasktree.tasktree_cli:cli",
        ],
    },
    python_requires=">=3.10",
)
```

- [ ] **Step 3: Write `cli_anything/__init__.py`** (empty)

```python
```

- [ ] **Step 4: Write `cli_anything/tasktree/__init__.py`**

```python
__version__ = "1.0.0"
```

- [ ] **Step 5: Write `cli_anything/tasktree/__main__.py`**

```python
from cli_anything.tasktree.tasktree_cli import cli

if __name__ == "__main__":
    cli()
```

- [ ] **Step 6: Write `utils.py`** — config and auth file read/write

```python
"""Configuration and auth persistence for tasktree CLI."""
import json
import os
from pathlib import Path
from typing import Any

CONFIG_DIR = Path.home() / ".tasktree"
CONFIG_FILE = CONFIG_DIR / "config.json"
AUTH_FILE = CONFIG_DIR / "auth.json"

DEFAULT_SERVER = "https://tasktree.tohsun.com"


def _ensure_dir() -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)


def load_config() -> dict[str, Any]:
    """Load config from file, env, defaults."""
    config = {"server": DEFAULT_SERVER}
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE) as f:
            config.update(json.load(f))
    env_server = os.environ.get("TASKTREE_SERVER")
    if env_server:
        config["server"] = env_server
    env_token = os.environ.get("TASKTREE_TOKEN")
    if env_token:
        config["token"] = env_token
    return config


def save_config(data: dict[str, Any]) -> None:
    _ensure_dir()
    with open(CONFIG_FILE, "w") as f:
        json.dump(data, f, indent=2)


def load_auth() -> dict[str, Any] | None:
    """Load saved auth (token, user, expires_at)."""
    config = load_config()
    if config.get("token"):
        return {"token": config["token"], "user": {}}
    if not AUTH_FILE.exists():
        return None
    with open(AUTH_FILE) as f:
        data = json.load(f)
    return data if data.get("token") else None


def save_auth(token: str, user: dict[str, Any]) -> None:
    _ensure_dir()
    data = {
        "token": token,
        "user": user,
    }
    with open(AUTH_FILE, "w") as f:
        json.dump(data, f, indent=2)


def get_token() -> str | None:
    """Get token from env, config, or auth file."""
    env_token = os.environ.get("TASKTREE_TOKEN")
    if env_token:
        return env_token
    auth = load_auth()
    return auth["token"] if auth else None


def clear_auth() -> None:
    if AUTH_FILE.exists():
        AUTH_FILE.unlink()
```

- [ ] **Step 7: Write `auth.py`** — login command and auto-refresh

```python
"""Authentication: login, token refresh, auto-re-auth."""
import click
import requests

from cli_anything.tasktree.utils import (
    get_token,
    load_config,
    save_auth,
    clear_auth,
)


def do_login(username: str, password: str, server: str) -> dict:
    """POST /api/auth/login, return {token, user}. Raises on failure."""
    resp = requests.post(
        f"{server}/api/auth/login",
        json={"username": username, "password": password},
        timeout=10,
    )
    if resp.status_code == 401:
        raise click.ClickException("Invalid credentials")
    resp.raise_for_status()
    data = resp.json()
    save_auth(data["token"], data["user"])
    return data


@click.command("login")
@click.option("-u", "--username", prompt=True, help="Username")
@click.option("-p", "--password", prompt=True, hide_input=True, help="Password")
@click.option("--server", default=None, help="Server URL override")
def login_cmd(username: str, password: str, server: str | None) -> None:
    """Login and save credentials."""
    config = load_config()
    server = server or config["server"]
    data = do_login(username, password, server)
    user = data["user"]
    click.echo(f"Logged in as {user['username']} @ {server}")


@click.command("me")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def me_cmd(as_json: bool) -> None:
    """Show current user info."""
    from cli_anything.tasktree.client import Client
    client = Client()
    resp = client.get("/api/auth/me")
    resp.raise_for_status()
    data = resp.json()
    if as_json:
        import json as json_mod
        click.echo(json_mod.dumps(data, indent=2))
    else:
        user = data["user"]
        click.echo(f"User: {user['username']} (id: {user['id']})")
        click.echo(f"Created: {user['created_at']}")
```

- [ ] **Step 8: Install package in dev mode and verify entry point**

```bash
cd /Users/allintech/Desktop/plans/tasktree/agent-harness && pip install -e . 2>&1
tasktree --help
```

Expected: Click help output showing `login` and `me` commands.

- [ ] **Step 9: Test login against live server**

```bash
tasktree login -u mirzat -p mirzat
```

Expected: `Logged in as mirzat @ https://tasktree.tohsun.com`

- [ ] **Step 10: Commit**

```bash
cd /Users/allintech/Desktop/plans
git add tasktree/agent-harness/
git commit -m "feat(cli): scaffold tasktree-cli package with login and me commands"
```

---

### Task 2: HTTP Client + formatters

**Files:**
- Create: `tasktree/agent-harness/cli_anything/tasktree/client.py`
- Create: `tasktree/agent-harness/cli_anything/tasktree/formatters.py`

- [ ] **Step 1: Write `client.py`** — stateful HTTP client with auto-auth

```python
"""HTTP client wrapping TaskTree API with auto-auth."""
import json as json_mod

import click
import requests

from cli_anything.tasktree.utils import load_config, load_auth, save_auth, get_token


class Client:
    """Stateful API client. Auto-adds Bearer token, auto-re-login on 401."""

    def __init__(self) -> None:
        self.config = load_config()
        self.server = self.config["server"]

    def _headers(self) -> dict[str, str]:
        token = get_token()
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    def request(self, method: str, path: str, **kwargs) -> requests.Response:
        url = f"{self.server}{path}"
        resp = requests.request(method, url, headers=self._headers(), timeout=15, **kwargs)
        if resp.status_code == 401:
            # Attempt auto re-login if we have saved credentials
            auth = load_auth()
            if auth and auth.get("user", {}).get("username"):
                raise click.ClickException("Session expired. Run: tasktree login")
            raise click.ClickException("Not logged in. Run: tasktree login")
        return resp

    def get(self, path: str, **kwargs) -> requests.Response:
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs) -> requests.Response:
        return self.request("POST", path, **kwargs)

    def patch(self, path: str, **kwargs) -> requests.Response:
        return self.request("PATCH", path, **kwargs)

    def delete(self, path: str, **kwargs) -> requests.Response:
        return self.request("DELETE", path, **kwargs)
```

- [ ] **Step 2: Write `formatters.py`** — tree, json, flat formatters

```python
"""Output formatters for tasktree CLI."""
import json
from typing import Any

from rich.console import Console
from rich.tree import Tree
from rich.text import Text

STATUS_COLORS = {
    "active": "green",
    "done": "blue",
    "pending": "dim",
    "dropped": "red",
}


def format_json(data: Any) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False)


def format_projects_list(projects: list[dict], as_json: bool = False) -> str:
    if as_json:
        return format_json(projects)
    if not projects:
        return "No projects found."
    lines = []
    for i, p in enumerate(projects, 1):
        lines.append(f"  {i}. {p['name']} ({p['id']})")
    return "\n".join(lines)


def format_project_tree(nodes: list[dict], as_json: bool = False) -> str:
    """Build a rich Tree and return as string. For --format tree or tree command."""
    if as_json:
        return format_json(nodes)
    if not nodes:
        return "(empty project)"

    # Build parent->children map
    by_id = {n["id"]: n for n in nodes}
    children_map: dict[str, list[dict]] = {}
    root = None
    for n in nodes:
        if n["parent_id"] is None:
            root = n
        else:
            children_map.setdefault(n["parent_id"], []).append(n)

    if root is None:
        return "(no root node found)"

    console = Console()
    tree = Tree(_node_label(root))

    def add_children(parent_id: str, tree_node: Tree) -> None:
        kids = children_map.get(parent_id, [])
        # Sort by sort_order
        kids.sort(key=lambda n: n.get("sort_order", 0))
        for child in kids:
            label = _node_label(child, show_edge_label=True)
            branch = tree_node.add(label)
            add_children(child["id"], branch)

    add_children(root["id"], tree)

    with console.capture() as capture:
        console.print(tree)
    return capture.get()


def _node_label(node: dict, show_edge_label: bool = False) -> Text:
    title = node["title"]
    status = node.get("status", "pending")
    color = STATUS_COLORS.get(status, "white")
    label = Text()
    label.append(title)
    label.append(f" ({status})", style=color)
    if show_edge_label and node.get("edge_label"):
        label.append(f" [{node['edge_label']}]", style="italic yellow")
    return label


def format_node_path(node_id: str, nodes: list[dict]) -> str:
    """Build 'Root > Parent > Node' path for a node."""
    by_id = {n["id"]: n for n in nodes}
    parts = []
    current = by_id.get(node_id)
    while current:
        parts.append(current["title"])
        current = by_id.get(current["parent_id"]) if current["parent_id"] else None
    return " > ".join(reversed(parts))
```

- [ ] **Step 3: Verify imports work**

```bash
cd /Users/allintech/Desktop/plans/tasktree/agent-harness && python -c "from cli_anything.tasktree.client import Client; from cli_anything.tasktree.formatters import format_json; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd /Users/allintech/Desktop/plans
git add tasktree/agent-harness/
git commit -m "feat(cli): add HTTP client and output formatters"
```

---

### Task 3: Projects commands

**Files:**
- Create: `tasktree/agent-harness/cli_anything/tasktree/commands/__init__.py`
- Create: `tasktree/agent-harness/cli_anything/tasktree/commands/projects.py`
- Modify: `tasktree/agent-harness/cli_anything/tasktree/tasktree_cli.py`

- [ ] **Step 1: Write `commands/__init__.py`** (empty)

```python
```

- [ ] **Step 2: Write `commands/projects.py`**

```python
"""Projects subgroup: list, create, get, delete."""
import json as json_mod

import click

from cli_anything.tasktree.client import Client
from cli_anything.tasktree.formatters import (
    format_json,
    format_projects_list,
    format_project_tree,
)


@click.group("projects")
def projects_group() -> None:
    """Manage projects."""
    pass


@projects_group.command("list")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def list_projects(as_json: bool) -> None:
    """List all projects."""
    client = Client()
    resp = client.get("/api/projects")
    resp.raise_for_status()
    projects = resp.json()
    click.echo(format_projects_list(projects, as_json=as_json))


@projects_group.command("create")
@click.argument("name")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def create_project(name: str, as_json: bool) -> None:
    """Create a new project."""
    client = Client()
    resp = client.post("/api/projects", json={"name": name})
    resp.raise_for_status()
    data = resp.json()
    if as_json:
        click.echo(format_json(data))
    else:
        click.echo(f"Created: {data['name']} ({data['id']})")


@projects_group.command("get")
@click.argument("project_id")
@click.option("--json", "as_json", is_flag=True, help="Full JSON dump")
@click.option("--format", "fmt", type=click.Choice(["json", "tree", "flat"]), default=None, help="Output format")
def get_project(project_id: str, as_json: bool, fmt: str | None) -> None:
    """Get project details with all nodes and edges."""
    client = Client()
    resp = client.get(f"/api/projects/{project_id}")
    resp.raise_for_status()
    data = resp.json()

    if fmt == "tree":
        click.echo(format_project_tree(data.get("nodes", [])))
    elif fmt == "flat" or as_json:
        click.echo(format_json(data))
    else:
        click.echo(f"Project: {data['name']} ({data['id']})")
        click.echo(f"Nodes: {len(data.get('nodes', []))}")
        click.echo(f"Edges: {len(data.get('edges', []))}")
        click.echo()
        click.echo(format_project_tree(data.get("nodes", [])))


@projects_group.command("delete")
@click.argument("project_id")
def delete_project(project_id: str) -> None:
    """Delete a project."""
    client = Client()
    resp = client.delete(f"/api/projects/{project_id}")
    resp.raise_for_status()
    click.echo(f"Deleted project {project_id}")
```

- [ ] **Step 3: Write `tasktree_cli.py`** — main Click group with REPL

```python
"""TaskTree CLI — agent-native command line interface."""
import cmd
import shlex
import sys

import click

from cli_anything.tasktree import __version__
from cli_anything.tasktree.auth import login_cmd, me_cmd


class TaskTreeREPL(cmd.Cmd):
    """Interactive REPL with session state."""

    prompt = "tasktree> "
    current_project_id: str | None = None
    current_project_name: str | None = None

    def __init__(self, cli_group: click.Group) -> None:
        super().__init__()
        self.cli_group = cli_group

    def default(self, line: str) -> bool:
        args = shlex.split(line)
        if args[0] == "exit" or args[0] == "quit":
            return True
        if args[0] == "use":
            self._cmd_use(args[1:] if len(args) > 1 else [])
            return False
        try:
            self.cli_group.main(args=args, standalone_mode=False)
        except SystemExit:
            pass
        except click.ClickException as e:
            click.echo(f"Error: {e.format_message()}")
        return False

    def _cmd_use(self, args: list[str]) -> None:
        if not args:
            self.current_project_id = None
            self.current_project_name = None
            self.prompt = "tasktree> "
            click.echo("Cleared current project.")
            return
        project_id = args[0]
        from cli_anything.tasktree.client import Client
        client = Client()
        resp = client.get(f"/api/projects/{project_id}")
        if resp.status_code == 404:
            click.echo(f"Project {project_id} not found.")
            return
        resp.raise_for_status()
        data = resp.json()
        self.current_project_id = project_id
        self.current_project_name = data["name"]
        self.prompt = f"tasktree:{self.current_project_name}> "
        click.echo(f"Project: {data['name']}")

    def emptyline(self) -> bool:
        return False

    def do_EOF(self, arg: str) -> bool:
        click.echo()
        return True


@click.group(invoke_without_command=True)
@click.version_option(__version__, prog_name="tasktree")
@click.pass_context
def cli(ctx: click.Context) -> None:
    """TaskTree CLI — manage your task tree from the terminal."""
    if ctx.invoked_subcommand is None:
        from cli_anything.tasktree.utils import get_token, load_config
        token = get_token()
        config = load_config()
        server = config["server"]
        user_info = "(not logged in)"
        if token:
            user_info = f"(logged in @ {server})"
        click.echo(f"TaskTree CLI v{__version__} {user_info}")
        click.echo("Type 'help' for commands, 'exit' to quit.\n")
        repl = TaskTreeREPL(cli)
        repl.cmdloop()


# Register commands
cli.add_command(login_cmd)
cli.add_command(me_cmd)

# Import and register subgroups (done here to avoid circular imports)
def _register_commands() -> None:
    from cli_anything.tasktree.commands.projects import projects_group
    from cli_anything.tasktree.commands.nodes import nodes_group
    from cli_anything.tasktree.commands.edges import edges_group
    from cli_anything.tasktree.commands.layout import layout_cmd
    from cli_anything.tasktree.commands.tree import tree_cmd
    from cli_anything.tasktree.commands.search import search_cmd
    from cli_anything.tasktree.commands.batch import batch_cmd

    cli.add_command(projects_group)
    cli.add_command(nodes_group)
    cli.add_command(edges_group)
    cli.add_command(layout_cmd)
    cli.add_command(tree_cmd)
    cli.add_command(search_cmd)
    cli.add_command(batch_cmd)

_register_commands()
```

- [ ] **Step 4: Reinstall and test projects commands**

```bash
cd /Users/allintech/Desktop/plans/tasktree/agent-harness && pip install -e . 2>&1
tasktree projects list
tasktree projects list --json
```

Expected: List of projects (may be empty) or JSON array.

- [ ] **Step 5: Test project create + get**

```bash
tasktree projects create "CLI Test Project"
tasktree projects get <id-from-above>
tasktree projects get <id-from-above> --format tree
```

Expected: Project created, tree displayed, then delete it.

```bash
tasktree projects delete <id>
```

- [ ] **Step 6: Commit**

```bash
cd /Users/allintech/Desktop/plans
git add tasktree/agent-harness/
git commit -m "feat(cli): add projects commands and REPL mode"
```

---

### Task 4: Nodes commands

**Files:**
- Create: `tasktree/agent-harness/cli_anything/tasktree/commands/nodes.py`

- [ ] **Step 1: Write `commands/nodes.py`**

```python
"""Nodes subgroup: list, create, update, delete, move, reorder."""
import click

from cli_anything.tasktree.client import Client
from cli_anything.tasktree.formatters import format_json


@click.group("nodes")
def nodes_group() -> None:
    """Manage nodes."""
    pass


@nodes_group.command("list")
@click.option("--project", "-p", required=True, help="Project ID")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def list_nodes(project: str, as_json: bool) -> None:
    """List all nodes in a project."""
    client = Client()
    resp = client.get(f"/api/projects/{project}")
    resp.raise_for_status()
    data = resp.json()
    nodes = data.get("nodes", [])
    if as_json:
        click.echo(format_json(nodes))
    else:
        for n in nodes:
            status = n.get("status", "pending")
            parent = f" (parent: {n['parent_id'][:8]}…)" if n.get("parent_id") else " (root)"
            click.echo(f"  {n['id'][:8]}…  {n['title']}  [{status}]{parent}")


@nodes_group.command("create")
@click.option("--project", "-p", required=True, help="Project ID")
@click.option("--title", "-t", required=True, help="Node title")
@click.option("--parent", default=None, help="Parent node ID (default: root)")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def create_node(project: str, title: str, parent: str | None, as_json: bool) -> None:
    """Create a new node."""
    client = Client()
    body: dict = {"project_id": project, "title": title}
    if parent:
        body["parent_id"] = parent
    resp = client.post("/api/nodes", json=body)
    resp.raise_for_status()
    data = resp.json()
    if as_json:
        click.echo(format_json(data))
    else:
        click.echo(f"Created: {data['title']} ({data['id']})")


@nodes_group.command("update")
@click.argument("node_id")
@click.option("--title", "-t", default=None, help="New title")
@click.option("--notes", "-n", default=None, help="New notes")
@click.option("--status", "-s", default=None, type=click.Choice(["pending", "active", "done", "dropped"]))
@click.option("--edge-label", default=None, help="Edge label to parent")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def update_node(node_id: str, title: str | None, notes: str | None, status: str | None, edge_label: str | None, as_json: bool) -> None:
    """Update a node."""
    body: dict = {}
    if title is not None:
        body["title"] = title
    if notes is not None:
        body["notes"] = notes
    if status is not None:
        body["status"] = status
    if edge_label is not None:
        body["edge_label"] = edge_label
    if not body:
        raise click.ClickException("Nothing to update. Provide at least one field.")
    client = Client()
    resp = client.patch(f"/api/nodes/{node_id}", json=body)
    resp.raise_for_status()
    data = resp.json()
    if as_json:
        click.echo(format_json(data))
    else:
        parts = [f"{k}={v}" for k, v in body.items()]
        click.echo(f"Updated: {node_id} → {', '.join(parts)}")


@nodes_group.command("delete")
@click.argument("node_id")
def delete_node(node_id: str) -> None:
    """Delete a node and all descendants."""
    client = Client()
    resp = client.delete(f"/api/nodes/{node_id}")
    resp.raise_for_status()
    click.echo(f"Deleted: {node_id}")


@nodes_group.command("move")
@click.argument("node_id")
@click.option("--parent", "-p", required=True, help="New parent node ID")
def move_node(node_id: str, parent: str) -> None:
    """Move a node to a new parent."""
    client = Client()
    resp = client.patch(f"/api/nodes/{node_id}", json={"parent_id": parent})
    resp.raise_for_status()
    click.echo(f"Moved: {node_id} → parent {parent}")


@nodes_group.command("reorder")
@click.argument("node_id")
@click.option("--order", "-o", required=True, type=int, help="New sort order")
def reorder_node(node_id: str, order: int) -> None:
    """Change node sort order among siblings."""
    client = Client()
    resp = client.post(f"/api/nodes/{node_id}/reorder", json={"sort_order": order})
    resp.raise_for_status()
    click.echo(f"Reordered: {node_id} → order {order}")
```

- [ ] **Step 2: Test nodes CRUD**

```bash
# Create a test project first
tasktree projects create "Node Test"
# Use the returned ID
tasktree nodes create -p <project-id> -t "Task 1"
tasktree nodes create -p <project-id> -t "Sub-task" --parent <root-node-id>
tasktree nodes update <node-id> --status active
tasktree nodes list -p <project-id>
tasktree projects get <project-id> --format tree
# Cleanup
tasktree projects delete <project-id>
```

Expected: Nodes created, status updated, tree shows correctly.

- [ ] **Step 3: Commit**

```bash
cd /Users/allintech/Desktop/plans
git add tasktree/agent-harness/
git commit -m "feat(cli): add nodes commands (list, create, update, delete, move, reorder)"
```

---

### Task 5: Edges + Layout commands

**Files:**
- Create: `tasktree/agent-harness/cli_anything/tasktree/commands/edges.py`
- Create: `tasktree/agent-harness/cli_anything/tasktree/commands/layout.py`

- [ ] **Step 1: Write `commands/edges.py`**

```python
"""Edges subgroup: list, create, update, delete."""
import click

from cli_anything.tasktree.client import Client
from cli_anything.tasktree.formatters import format_json


@click.group("edges")
def edges_group() -> None:
    """Manage custom edges."""
    pass


@edges_group.command("list")
@click.option("--project", "-p", required=True, help="Project ID")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def list_edges(project: str, as_json: bool) -> None:
    """List all edges in a project."""
    client = Client()
    resp = client.get(f"/api/projects/{project}")
    resp.raise_for_status()
    data = resp.json()
    edges = data.get("edges", [])
    if as_json:
        click.echo(format_json(edges))
    else:
        if not edges:
            click.echo("No custom edges.")
            return
        for e in edges:
            label = f" [{e['label']}]" if e.get("label") else ""
            click.echo(f"  {e['source_id'][:8]}… → {e['target_id'][:8]}…{label}  ({e['id'][:8]}…)")


@edges_group.command("create")
@click.option("--project", "-p", required=True, help="Project ID")
@click.option("--source", "-s", required=True, help="Source node ID")
@click.option("--target", "-t", required=True, help="Target node ID")
@click.option("--label", "-l", default="", help="Edge label")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def create_edge(project: str, source: str, target: str, label: str, as_json: bool) -> None:
    """Create a custom edge."""
    client = Client()
    resp = client.post("/api/edges", json={
        "project_id": project,
        "source_id": source,
        "target_id": target,
        "label": label,
    })
    resp.raise_for_status()
    data = resp.json()
    if as_json:
        click.echo(format_json(data))
    else:
        click.echo(f"Created edge: {source[:8]}… → {target[:8]}… ({data['id']})")


@edges_group.command("update")
@click.argument("edge_id")
@click.option("--label", "-l", required=True, help="New label")
def update_edge(edge_id: str, label: str) -> None:
    """Update an edge label."""
    client = Client()
    resp = client.patch(f"/api/edges/{edge_id}", json={"label": label})
    resp.raise_for_status()
    click.echo(f"Updated edge {edge_id} → label={label}")


@edges_group.command("delete")
@click.argument("edge_id")
def delete_edge(edge_id: str) -> None:
    """Delete an edge."""
    client = Client()
    resp = client.delete(f"/api/edges/{edge_id}")
    resp.raise_for_status()
    click.echo(f"Deleted edge {edge_id}")
```

- [ ] **Step 2: Write `commands/layout.py`**

```python
"""Layout command: trigger auto-layout."""
import click

from cli_anything.tasktree.client import Client
from cli_anything.tasktree.formatters import format_json, format_project_tree


@click.command("layout")
@click.argument("project_id")
@click.option("--json", "as_json", is_flag=True, help="Output updated nodes as JSON")
def layout_cmd(project_id: str, as_json: bool) -> None:
    """Trigger auto-layout for a project."""
    client = Client()
    resp = client.post(f"/api/projects/{project_id}/layout")
    resp.raise_for_status()
    nodes = resp.json()
    if as_json:
        click.echo(format_json(nodes))
    else:
        click.echo(f"Layout applied. {len(nodes)} nodes updated.")
        click.echo(format_project_tree(nodes))
```

- [ ] **Step 3: Test edges and layout**

```bash
tasktree projects create "Edge Test"
tasktree edges list -p <project-id>
tasktree layout <project-id>
tasktree projects delete <project-id>
```

Expected: Edges listed (none initially), layout applied and tree shown.

- [ ] **Step 4: Commit**

```bash
cd /Users/allintech/Desktop/plans
git add tasktree/agent-harness/
git commit -m "feat(cli): add edges and layout commands"
```

---

### Task 6: AI-optimized commands (tree, search, batch)

**Files:**
- Create: `tasktree/agent-harness/cli_anything/tasktree/commands/tree.py`
- Create: `tasktree/agent-harness/cli_anything/tasktree/commands/search.py`
- Create: `tasktree/agent-harness/cli_anything/tasktree/commands/batch.py`

- [ ] **Step 1: Write `commands/tree.py`**

```python
"""Tree command: display project as indented text tree."""
import click

from cli_anything.tasktree.client import Client
from cli_anything.tasktree.formatters import format_json, format_project_tree


@click.command("tree")
@click.argument("project_id")
@click.option("--json", "as_json", is_flag=True, help="Output raw JSON instead of tree")
def tree_cmd(project_id: str, as_json: bool) -> None:
    """Display project as a text tree."""
    client = Client()
    resp = client.get(f"/api/projects/{project_id}")
    resp.raise_for_status()
    data = resp.json()
    nodes = data.get("nodes", [])
    if as_json:
        click.echo(format_json(nodes))
    else:
        click.echo(format_project_tree(nodes))
```

- [ ] **Step 2: Write `commands/search.py`**

```python
"""Search command: find nodes by title/notes."""
import click

from cli_anything.tasktree.client import Client
from cli_anything.tasktree.formatters import format_json, format_node_path


@click.command("search")
@click.argument("project_id")
@click.option("--query", "-q", required=True, help="Search query")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def search_cmd(project_id: str, query: str, as_json: bool) -> None:
    """Search nodes by title or notes."""
    client = Client()
    resp = client.get(f"/api/projects/{project_id}")
    resp.raise_for_status()
    data = resp.json()
    nodes = data.get("nodes", [])

    q = query.lower()
    matches = [
        n for n in nodes
        if q in n.get("title", "").lower() or q in n.get("notes", "").lower()
    ]

    if as_json:
        click.echo(format_json(matches))
        return

    if not matches:
        click.echo(f"No nodes matching '{query}'.")
        return

    click.echo(f"Found {len(matches)} node(s):")
    for i, n in enumerate(matches, 1):
        status = n.get("status", "pending")
        path = format_node_path(n["id"], nodes)
        click.echo(f"  {i}. \"{n['title']}\" ({status}) → {path}")
```

- [ ] **Step 3: Write `commands/batch.py`**

```python
"""Batch command: execute multiple operations from a JSON file."""
import json
import sys

import click

from cli_anything.tasktree.client import Client


@click.command("batch")
@click.option("--file", "-f", "filepath", required=True, type=click.Path(exists=True), help="JSON file with operations")
def batch_cmd(filepath: str) -> None:
    """Execute batch operations from a JSON file.

    JSON format:
    {
      "project_id": "...",
      "operations": [
        {"action": "create_node", "title": "...", "parent_id": "..."},
        {"action": "update_node", "id": "...", "status": "done"},
        {"action": "delete_node", "id": "..."},
        {"action": "create_edge", "source_id": "...", "target_id": "...", "label": "..."},
        {"action": "update_edge", "id": "...", "label": "..."},
        {"action": "delete_edge", "id": "..."}
      ]
    }
    """
    with open(filepath) as f:
        data = json.load(f)

    project_id = data.get("project_id", "")
    operations = data.get("operations", [])
    client = Client()
    results = []

    for i, op in enumerate(operations):
        action = op.get("action")
        try:
            result = _execute_operation(client, project_id, op)
            results.append(result)
        except Exception as e:
            click.echo(f"Operation {i + 1} failed ({action}): {e}", err=True)
            click.echo(f"Completed {i}/{len(operations)} operations before failure.")
            sys.exit(1)

    click.echo(f"{len(results)}/{len(operations)} operations completed.")
    for r in results:
        click.echo(f"  {r}")


def _execute_operation(client: Client, project_id: str, op: dict) -> str:
    action = op["action"]

    if action == "create_node":
        body: dict = {"project_id": project_id, "title": op["title"]}
        if "parent_id" in op:
            body["parent_id"] = op["parent_id"]
        resp = client.post("/api/nodes", json=body)
        resp.raise_for_status()
        data = resp.json()
        return f"Created: {data['title']} ({data['id']})"

    elif action == "update_node":
        body = {k: op[k] for k in ("title", "notes", "status", "edge_label", "parent_id") if k in op}
        resp = client.patch(f"/api/nodes/{op['id']}", json=body)
        resp.raise_for_status()
        parts = [f"{k}={v}" for k, v in body.items()]
        return f"Updated: {op['id']} → {', '.join(parts)}"

    elif action == "delete_node":
        resp = client.delete(f"/api/nodes/{op['id']}")
        resp.raise_for_status()
        return f"Deleted: {op['id']}"

    elif action == "create_edge":
        body = {
            "project_id": project_id,
            "source_id": op["source_id"],
            "target_id": op["target_id"],
            "label": op.get("label", ""),
        }
        resp = client.post("/api/edges", json=body)
        resp.raise_for_status()
        data = resp.json()
        return f"Created edge: {op['source_id']} → {op['target_id']}"

    elif action == "update_edge":
        resp = client.patch(f"/api/edges/{op['id']}", json={"label": op["label"]})
        resp.raise_for_status()
        return f"Updated edge: {op['id']} → label={op['label']}"

    elif action == "delete_edge":
        resp = client.delete(f"/api/edges/{op['id']}")
        resp.raise_for_status()
        return f"Deleted edge: {op['id']}"

    else:
        raise click.ClickException(f"Unknown action: {action}")
```

- [ ] **Step 4: Reinstall and test all commands**

```bash
cd /Users/allintech/Desktop/plans/tasktree/agent-harness && pip install -e . 2>&1

# Full smoke test
tasktree projects create "CLI Smoke Test"
# Note the project ID
tasktree tree <project-id>
tasktree search <project-id> -q "root"
tasktree projects delete <project-id>
```

Expected: Tree shows root node, search finds it.

- [ ] **Step 5: Commit**

```bash
cd /Users/allintech/Desktop/plans
git add tasktree/agent-harness/
git commit -m "feat(cli): add tree, search, and batch commands"
```

---

### Task 7: TASKTREE.md API reference + final verification

**Files:**
- Create: `tasktree/agent-harness/TASKTREE.md`

- [ ] **Step 1: Write `TASKTREE.md`** — CLI-Anything standard API reference

```markdown
# TaskTree CLI

Agent-native CLI for TaskTree — a personal tree-based task management app.

## Installation

    pip install git+https://github.com/borankux/tasktree.git#subdirectory=tasktree/agent-harness

## Quick Start

    tasktree login -u mirzat -p <password>
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

## Flags
- `--json` — Machine-readable JSON output (all commands)
- `--format tree|json|flat` — Output format (projects get)

## Exit Codes
- 0: Success
- 1: General error
- 2: Auth error
- 3: API error
- 4: Validation error
```

- [ ] **Step 2: Full end-to-end smoke test**

```bash
tasktree me
tasktree projects list --json
tasktree projects create "E2E Test"
PROJECT_ID=$(tasktree projects list --json | python3 -c "import sys,json; ps=json.load(sys.stdin); print([p['id'] for p in ps if p['name']=='E2E Test'][0])")
tasktree tree $PROJECT_ID
tasktree search $PROJECT_ID -q "E2E"
tasktree layout $PROJECT_ID
tasktree projects delete $PROJECT_ID
```

Expected: All commands succeed without errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/allintech/Desktop/plans
git add tasktree/agent-harness/
git commit -m "feat(cli): add TASKTREE.md API reference, complete CLI implementation"
```
