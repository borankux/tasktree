"""Layout command for TaskTree CLI."""

import click

from cli_anything.tasktree.client import Client
from cli_anything.tasktree.formatters import format_json, format_project_tree


@click.command("layout")
@click.argument("project_id")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def layout_cmd(project_id: str, as_json: bool):
    """Recalculate tree layout for a project."""
    client = Client()
    resp = client.post(f"/api/projects/{project_id}/layout")
    if resp.status_code == 404:
        raise click.ClickException(f"Project {project_id} not found.")
    resp.raise_for_status()
    data = resp.json()
    nodes = data if isinstance(data, list) else data.get("nodes", [])

    if as_json:
        click.echo(format_json(data))
        return

    click.echo(f"Layout applied. {len(nodes)} nodes updated.")
    click.echo()
    # Fetch full project to render tree
    resp2 = client.get(f"/api/projects/{project_id}")
    resp2.raise_for_status()
    project_data = resp2.json()
    click.echo(format_project_tree(project_data.get("nodes", [])))
