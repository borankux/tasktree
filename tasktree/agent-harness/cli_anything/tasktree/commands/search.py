"""Search command: find nodes by title/notes."""
import click
from cli_anything.tasktree.client import Client
from cli_anything.tasktree.formatters import format_json, format_node_path


@click.command("search")
@click.argument("project_id")
@click.option("--query", "-q", required=True, help="Search query")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON")
def search_cmd(project_id, query, as_json):
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
