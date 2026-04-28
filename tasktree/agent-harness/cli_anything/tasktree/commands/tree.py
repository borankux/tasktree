"""Tree command: display project as indented text tree."""
import click
from cli_anything.tasktree.client import Client
from cli_anything.tasktree.formatters import format_json, format_project_tree


@click.command("tree")
@click.argument("project_id")
@click.option("--json", "as_json", is_flag=True, help="Output raw JSON instead of tree")
def tree_cmd(project_id, as_json):
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
