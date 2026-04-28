"""TaskTree CLI — agent-native command line interface."""

import cmd
import shlex

import click

from cli_anything.tasktree import __version__
from cli_anything.tasktree.auth import login_cmd, me_cmd


class TaskTreeREPL(cmd.Cmd):
    """Interactive REPL with session state."""

    prompt = "tasktree> "
    current_project_id = None
    current_project_name = None

    def __init__(self, cli_group):
        super().__init__()
        self.cli_group = cli_group

    def default(self, line):
        args = shlex.split(line)
        if args[0] in ("exit", "quit"):
            return True
        if args[0] == "use":
            self._cmd_use(args[1:] if len(args) > 1 else [])
            return False
        try:
            self.cli_group.main(args=args, standalone_mode=False)
        except SystemExit:
            pass
        except click.ClickException as e:
            click.echo(f"Error: {e.format_message()}")
        return False

    def _cmd_use(self, args):
        if not args:
            self.current_project_id = None
            self.current_project_name = None
            self.prompt = "tasktree> "
            click.echo("Cleared current project.")
            return
        project_id = args[0]
        from cli_anything.tasktree.client import Client

        client = Client()
        resp = client.get(f"/api/projects/{project_id}")
        if resp.status_code == 404:
            click.echo(f"Project {project_id} not found.")
            return
        resp.raise_for_status()
        data = resp.json()
        self.current_project_id = project_id
        self.current_project_name = data["name"]
        self.prompt = f"tasktree:{self.current_project_name}> "
        click.echo(f"Project: {data['name']}")

    def emptyline(self):
        return False

    def do_EOF(self, arg):
        click.echo()
        return True


@click.group(invoke_without_command=True)
@click.version_option(__version__, prog_name="tasktree")
@click.pass_context
def cli(ctx):
    """TaskTree CLI — manage your task tree from the terminal."""
    if ctx.invoked_subcommand is None:
        from cli_anything.tasktree.utils import get_token, load_config

        token = get_token()
        config = load_config()
        server = config["server"]
        user_info = "(not logged in)" if not token else f"(logged in @ {server})"
        click.echo(f"TaskTree CLI v{__version__} {user_info}")
        click.echo("Type 'help' for commands, 'exit' to quit.\n")
        repl = TaskTreeREPL(cli)
        repl.cmdloop()


# Register auth commands
cli.add_command(login_cmd)
cli.add_command(me_cmd)


# Lazy-import and register all command groups to avoid circular imports
def _register_commands():
    from cli_anything.tasktree.commands.projects import projects_group

    cli.add_command(projects_group)

    # These will be added in later tasks, but create placeholder imports
    # that won't crash if the modules don't exist yet
    try:
        from cli_anything.tasktree.commands.nodes import nodes_group

        cli.add_command(nodes_group)
    except ImportError:
        pass
    try:
        from cli_anything.tasktree.commands.edges import edges_group

        cli.add_command(edges_group)
    except ImportError:
        pass
    try:
        from cli_anything.tasktree.commands.layout import layout_cmd

        cli.add_command(layout_cmd)
    except ImportError:
        pass
    try:
        from cli_anything.tasktree.commands.tree import tree_cmd

        cli.add_command(tree_cmd)
    except ImportError:
        pass
    try:
        from cli_anything.tasktree.commands.search import search_cmd

        cli.add_command(search_cmd)
    except ImportError:
        pass
    try:
        from cli_anything.tasktree.commands.batch import batch_cmd

        cli.add_command(batch_cmd)
    except ImportError:
        pass


_register_commands()
