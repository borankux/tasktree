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
    """Build a rich Tree and return as string."""
    if as_json:
        return format_json(nodes)
    if not nodes:
        return "(empty project)"

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

    def add_children(parent_id: str, tree_node: Tree):
        kids = children_map.get(parent_id, [])
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
