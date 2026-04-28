"""HTTP client wrapping TaskTree API with auto-auth."""

import re

import click
import requests
from cli_anything.tasktree.utils import load_config, get_token

_UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)


class Client:
    """Stateful API client. Auto-adds Bearer token, auto-re-login on 401."""

    def __init__(self):
        self.config = load_config()
        self.server = self.config["server"]

    def _headers(self):
        token = get_token()
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    def request(self, method, path, **kwargs):
        url = f"{self.server}{path}"
        resp = requests.request(method, url, headers=self._headers(), timeout=15, **kwargs)
        if resp.status_code == 401:
            raise click.ClickException("Not logged in or session expired. Run: tasktree login")
        return resp

    def get(self, path, **kwargs):
        return self.request("GET", path, **kwargs)

    def post(self, path, **kwargs):
        return self.request("POST", path, **kwargs)

    def patch(self, path, **kwargs):
        return self.request("PATCH", path, **kwargs)

    def delete(self, path, **kwargs):
        return self.request("DELETE", path, **kwargs)

    def resolve_project(self, identifier: str) -> str:
        """Resolve a project name or ID to a project ID.

        If identifier looks like a UUID, return as-is.
        Otherwise, fetch project list and match by name.
        """
        if _UUID_RE.match(identifier):
            return identifier
        resp = self.get("/api/projects")
        resp.raise_for_status()
        projects = resp.json()
        matches = [p for p in projects if p["name"] == identifier]
        if not matches:
            # Try partial match
            matches = [p for p in projects if identifier.lower() in p["name"].lower()]
        if not matches:
            raise click.ClickException(f"Project '{identifier}' not found.")
        if len(matches) > 1:
            names = ", ".join(f"'{p['name']}' ({p['id'][:8]}…)" for p in matches)
            raise click.ClickException(f"Multiple projects match '{identifier}': {names}. Use the full ID.")
        return matches[0]["id"]
