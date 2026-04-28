"""Edges commands for TaskTree CLI."""

import click

from cli_anything.tasktree.client import Client
from cli_anything.tasktree.formatters import format_json


@click.group("edges")
def edges_group():
    """Manage custom edges between nodes."""


@edges_group.command("list")
@click.option("--project", "-p", required=True, help="Project ID")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def list_edges(project: str, as_json: bool):
    """List custom edges in a project."""
    client = Client()
    resp = client.get(f"/api/projects/{project}")
    if resp.status_code == 404:
        raise click.ClickException(f"Project {project} not found.")
    resp.raise_for_status()
    data = resp.json()
    edges = data.get("edges", [])

    if as_json:
        click.echo(format_json(edges))
        return

    if not edges:
        click.echo("No custom edges.")
        return

    for e in edges:
        src = e["source_id"][:8]
        tgt = e["target_id"][:8]
        eid = e["id"][:8]
        label = e.get("label", "")
        parts = f"{src}… → {tgt}…"
        if label:
            parts += f" [{label}]"
        parts += f" ({eid}…)"
        click.echo(parts)


@edges_group.command("create")
@click.option("--project", "-p", required=True, help="Project ID")
@click.option("--source", "-s", required=True, help="Source node ID")
@click.option("--target", "-t", required=True, help="Target node ID")
@click.option("--label", "-l", default="", help="Edge label")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def create_edge(project: str, source: str, target: str, label: str, as_json: bool):
    """Create a custom edge between two nodes."""
    client = Client()
    resp = client.post(
        "/api/edges",
        json={
            "project_id": project,
            "source_id": source,
            "target_id": target,
            "label": label,
        },
    )
    resp.raise_for_status()
    data = resp.json()

    if as_json:
        click.echo(format_json(data))
        return

    eid = data.get("id", "")[:8]
    src = source[:8]
    tgt = target[:8]
    label_part = f" [{label}]" if label else ""
    click.echo(f"Created edge {src}… → {tgt}…{label_part} ({eid}…)")


@edges_group.command("update")
@click.argument("edge_id")
@click.option("--label", "-l", required=True, help="New edge label")
def update_edge(edge_id: str, label: str):
    """Update an edge's label."""
    client = Client()
    resp = client.patch(f"/api/edges/{edge_id}", json={"label": label})
    if resp.status_code == 404:
        raise click.ClickException(f"Edge {edge_id} not found.")
    resp.raise_for_status()
    click.echo(f"Updated edge {edge_id[:8]}… label to '{label}'.")


@edges_group.command("delete")
@click.argument("edge_id")
def delete_edge(edge_id: str):
    """Delete a custom edge."""
    client = Client()
    resp = client.delete(f"/api/edges/{edge_id}")
    if resp.status_code == 404:
        raise click.ClickException(f"Edge {edge_id} not found.")
    resp.raise_for_status()
    click.echo(f"Deleted edge {edge_id[:8]}….")
