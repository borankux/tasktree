from setuptools import setup, find_packages

setup(
    name="tasktree-cli",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "click>=8.0",
        "requests>=2.28",
        "rich>=13.0",
    ],
    entry_points={
        "console_scripts": [
            "tasktree=cli_anything.tasktree.tasktree_cli:cli",
        ],
    },
    python_requires=">=3.10",
)
