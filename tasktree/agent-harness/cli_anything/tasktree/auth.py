"""Authentication commands for TaskTree CLI."""

import click
import requests
from rich import print as rprint

from cli_anything.tasktree.utils import resolve_server, save_auth, get_token


def do_login(username: str, password: str, server: str) -> dict:
    """POST /api/auth/login and persist the token.

    Returns the parsed JSON response on success.
    Raises click.ClickException on failure.
    """
    url = f"{server}/api/auth/login"
    try:
        resp = requests.post(
            url,
            json={"username": username, "password": password},
            timeout=15,
        )
    except requests.RequestException as exc:
        raise click.ClickException(f"Connection error: {exc}")

    if resp.status_code != 200:
        try:
            detail = resp.json().get("error", resp.text)
        except Exception:
            detail = resp.text
        raise click.ClickException(f"Login failed ({resp.status_code}): {detail}")

    data = resp.json()
    token = data.get("token")
    user = data.get("user", {})
    if not token:
        raise click.ClickException("Server did not return a token.")

    save_auth(token, user)
    return {"token": token, "user": user, "server": server}


@click.command("login")
@click.option("-u", "--username", required=True, help="Username")
@click.option("-p", "--password", required=True, help="Password")
@click.option("--server", default=None, help="Server URL (overrides config)")
def login_cmd(username: str, password: str, server: str | None) -> None:
    """Log in to TaskTree and store credentials."""
    resolved = resolve_server(server)
    result = do_login(username, password, resolved)
    name = result["user"].get("username") or result["user"].get("name") or username
    click.echo(f"Logged in as {name} @ {resolved}")


@click.command("me")
@click.option("--json", "as_json", is_flag=True, help="Output raw JSON")
def me_cmd(as_json: bool) -> None:
    """Show the currently authenticated user."""
    token = get_token()
    if not token:
        raise click.ClickException("Not logged in. Run 'tasktree login' first.")

    server = resolve_server()
    url = f"{server}/api/auth/me"
    try:
        resp = requests.get(
            url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
    except requests.RequestException as exc:
        raise click.ClickException(f"Connection error: {exc}")

    if resp.status_code != 200:
        raise click.ClickException(f"Request failed ({resp.status_code}): {resp.text}")

    data = resp.json()
    if as_json:
        import json as _json
        click.echo(_json.dumps(data, indent=2))
    else:
        rprint(data)
