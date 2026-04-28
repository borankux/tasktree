"""Configuration and auth file utilities for TaskTree CLI."""

import json
import os
from pathlib import Path
from typing import Any

CONFIG_DIR = Path.home() / ".tasktree"
CONFIG_FILE = CONFIG_DIR / "config.json"
AUTH_FILE = CONFIG_DIR / "auth.json"

DEFAULT_SERVER = "https://tasktree.tohsun.com"


def _ensure_config_dir() -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)


def load_config() -> dict[str, Any]:
    """Load config from ~/.tasktree/config.json, falling back to defaults."""
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE) as f:
            return json.load(f)
    return {"server": DEFAULT_SERVER}


def save_config(data: dict[str, Any]) -> None:
    """Write config to ~/.tasktree/config.json."""
    _ensure_config_dir()
    with open(CONFIG_FILE, "w") as f:
        json.dump(data, f, indent=2)


def load_auth() -> dict[str, Any]:
    """Load auth data from ~/.tasktree/auth.json."""
    if AUTH_FILE.exists():
        with open(AUTH_FILE) as f:
            return json.load(f)
    return {}


def save_auth(token: str, user: dict[str, Any]) -> None:
    """Write auth token and user info to ~/.tasktree/auth.json."""
    _ensure_config_dir()
    data = {"token": token, "user": user}
    with open(AUTH_FILE, "w") as f:
        json.dump(data, f, indent=2)


def get_token() -> str | None:
    """Return the stored JWT token, checking env var first then auth file.

    Priority: TASKTREE_TOKEN env var > auth file.
    """
    env_token = os.environ.get("TASKTREE_TOKEN")
    if env_token:
        return env_token
    auth = load_auth()
    return auth.get("token")


def clear_auth() -> None:
    """Delete the auth file."""
    if AUTH_FILE.exists():
        AUTH_FILE.unlink()


def resolve_server(cli_server: str | None = None) -> str:
    """Resolve the server URL from multiple sources.

    Priority: CLI flag > TASKTREE_SERVER env var > config file > default.
    """
    if cli_server:
        return cli_server
    env_server = os.environ.get("TASKTREE_SERVER")
    if env_server:
        return env_server
    config = load_config()
    return config.get("server", DEFAULT_SERVER)
