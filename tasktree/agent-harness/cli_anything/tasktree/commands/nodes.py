"""Nodes commands for TaskTree CLI."""

import click

from cli_anything.tasktree.client import Client
from cli_anything.tasktree.formatters import format_json


def _short_id(node_id: str, length: int = 8) -> str:
    """Return first `length` chars of a node ID with ellipsis if truncated."""
    if len(node_id) > length:
        return node_id[:length] + "\u2026"
    return node_id


@click.group("nodes")
def nodes_group():
    """Manage nodes."""
    pass


@nodes_group.command("list")
@click.option("--project", "-p", required=True, help="Project ID")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def list_nodes(project: str, as_json: bool):
    """List all nodes in a project."""
    client = Client()
    project = client.resolve_project(project)
    resp = client.get(f"/api/projects/{project}")
    if resp.status_code == 404:
        raise click.ClickException(f"Project {project} not found.")
    resp.raise_for_status()
    data = resp.json()
    nodes = data.get("nodes", [])

    if as_json:
        click.echo(format_json(nodes))
        return

    if not nodes:
        click.echo("(no nodes)")
        return

    for n in nodes:
        sid = _short_id(n["id"])
        title = n["title"]
        status = n.get("status", "pending")
        parent_id = n.get("parent_id")
        if parent_id:
            parent_short = _short_id(parent_id)
            click.echo(f"{sid}  {title}  [{status}]  (parent: {parent_short})")
        else:
            click.echo(f"{sid}  {title}  [{status}]  (root)")


@nodes_group.command("create")
@click.option("--project", "-p", required=True, help="Project ID")
@click.option("--title", "-t", required=True, help="Node title")
@click.option("--parent", default=None, help="Parent node ID (default: root)")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def create_node(project: str, title: str, parent: str | None, as_json: bool):
    """Create a new node."""
    client = Client()
    project = client.resolve_project(project)
    body = {
        "project_id": project,
        "title": title,
        "parent_id": parent,
    }
    resp = client.post("/api/nodes", json=body)
    resp.raise_for_status()
    data = resp.json()

    if as_json:
        click.echo(format_json(data))
    else:
        click.echo(f"Created: {data.get('title', title)} ({data.get('id', '')})")


@nodes_group.command("update")
@click.argument("node_id")
@click.option("--title", "-t", default=None, help="New title")
@click.option("--notes", "-n", default=None, help="New notes")
@click.option(
    "--status",
    "-s",
    type=click.Choice(["pending", "active", "done", "dropped"]),
    default=None,
    help="New status",
)
@click.option("--edge-label", default=None, help="Edge label to parent")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def update_node(
    node_id: str,
    title: str | None,
    notes: str | None,
    status: str | None,
    edge_label: str | None,
    as_json: bool,
):
    """Update a node's fields."""
    body = {}
    if title is not None:
        body["title"] = title
    if notes is not None:
        body["notes"] = notes
    if status is not None:
        body["status"] = status
    if edge_label is not None:
        body["edge_label"] = edge_label

    if not body:
        raise click.ClickException(
            "Nothing to update. Provide at least one of: --title, --notes, --status, --edge-label"
        )

    client = Client()
    resp = client.patch(f"/api/nodes/{node_id}", json=body)
    if resp.status_code == 404:
        raise click.ClickException(f"Node {node_id} not found.")
    resp.raise_for_status()
    data = resp.json()

    if as_json:
        click.echo(format_json(data))
    else:
        changes = ", ".join(f"{k}={v}" for k, v in body.items())
        click.echo(f"Updated: {node_id} \u2192 {changes}")


@nodes_group.command("delete")
@click.argument("node_id")
def delete_node(node_id: str):
    """Delete a node and all its descendants."""
    client = Client()
    resp = client.delete(f"/api/nodes/{node_id}")
    if resp.status_code == 404:
        raise click.ClickException(f"Node {node_id} not found.")
    resp.raise_for_status()
    click.echo(f"Deleted: {node_id}")


@nodes_group.command("move")
@click.argument("node_id")
@click.option("--parent", "-p", required=True, help="New parent node ID")
def move_node(node_id: str, parent: str):
    """Move a node to a new parent."""
    client = Client()
    resp = client.patch(f"/api/nodes/{node_id}", json={"parent_id": parent})
    if resp.status_code == 404:
        raise click.ClickException(f"Node {node_id} not found.")
    resp.raise_for_status()
    click.echo(f"Moved: {node_id} \u2192 parent {parent}")


@nodes_group.command("reorder")
@click.argument("node_id")
@click.option("--order", "-o", required=True, type=int, help="New sort order")
def reorder_node(node_id: str, order: int):
    """Reorder a node among its siblings."""
    client = Client()
    resp = client.post(f"/api/nodes/{node_id}/reorder", json={"sort_order": order})
    if resp.status_code == 404:
        raise click.ClickException(f"Node {node_id} not found.")
    resp.raise_for_status()
    click.echo(f"Reordered: {node_id} \u2192 order {order}")
