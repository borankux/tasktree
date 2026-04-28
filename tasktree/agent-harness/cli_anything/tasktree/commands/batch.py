"""Batch command: execute multiple operations from a JSON file."""
import json
import sys
import click
from cli_anything.tasktree.client import Client


@click.command("batch")
@click.option("--file", "-f", "filepath", required=True, type=click.Path(exists=True), help="JSON file with operations")
def batch_cmd(filepath):
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


def _execute_operation(client, project_id, op):
    action = op["action"]

    if action == "create_node":
        body = {"project_id": project_id, "title": op["title"]}
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
