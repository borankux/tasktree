"""HTTP client wrapping TaskTree API with auto-auth."""

import click
import requests
from cli_anything.tasktree.utils import load_config, get_token


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
