"""Projects commands for TaskTree CLI."""

import click

from cli_anything.tasktree.client import Client
from cli_anything.tasktree.formatters import (
    format_json,
    format_projects_list,
    format_project_tree,
)


@click.group("projects")
def projects_group():
    """Manage projects."""


@projects_group.command("list")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def list_projects(as_json: bool):
    """List all projects."""
    client = Client()
    resp = client.get("/api/projects")
    resp.raise_for_status()
    projects = resp.json()
    click.echo(format_projects_list(projects, as_json=as_json))


@projects_group.command("create")
@click.argument("name")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def create_project(name: str, as_json: bool):
    """Create a new project."""
    client = Client()
    resp = client.post("/api/projects", json={"name": name})
    resp.raise_for_status()
    data = resp.json()
    if as_json:
        click.echo(format_json(data))
    else:
        click.echo(f"Created project: {data.get('name', name)} ({data.get('id', '')})")


@projects_group.command("get")
@click.argument("project_id")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
@click.option(
    "--format",
    "fmt",
    type=click.Choice(["tree", "json", "flat"]),
    default="tree",
    help="Output format (default: tree)",
)
def get_project(project_id: str, as_json: bool, fmt: str):
    """Show project details and node tree."""
    client = Client()
    project_id = client.resolve_project(project_id)
    resp = client.get(f"/api/projects/{project_id}")
    if resp.status_code == 404:
        raise click.ClickException(f"Project {project_id} not found.")
    resp.raise_for_status()
    data = resp.json()

    # If --json flag is set, output raw JSON and return
    if as_json or fmt == "json":
        click.echo(format_json(data))
        return

    # Show project header
    project_name = data.get("name", "Unknown")
    nodes = data.get("nodes", [])
    click.echo(f"Project: {project_name} ({project_id})")
    click.echo(f"Nodes: {len(nodes)}")
    click.echo()

    # Show tree
    if fmt == "tree":
        click.echo(format_project_tree(nodes))
    else:
        # flat: one line per node
        if not nodes:
            click.echo("(empty project)")
        else:
            for n in nodes:
                status = n.get("status", "pending")
                parent = n.get("parent_id") or "(root)"
                click.echo(f"  {n['id']}  {n['title']}  [{status}]  parent={parent}")


@projects_group.command("delete")
@click.argument("project_id")
@click.option("--yes", "-y", is_flag=True, help="Skip confirmation")
def delete_project(project_id: str, yes: bool):
    """Delete a project and all its nodes."""
    client = Client()
    project_id = client.resolve_project(project_id)
    if not yes:
        click.confirm(f"Delete project {project_id}?", abort=True)
    resp = client.delete(f"/api/projects/{project_id}")
    if resp.status_code == 404:
        raise click.ClickException(f"Project {project_id} not found.")
    resp.raise_for_status()
    click.echo(f"Deleted project {project_id}.")
