"""Run the documented Git workflow against a local bare repo and two fake homes."""
import os
from pathlib import Path
import re
import shlex
import subprocess
import tempfile
import unittest


GUIDE = Path(__file__).resolve().parents[1] / "docs/chezmoi-for-friends.ko.md"


class GitSyncTest(unittest.TestCase):
    def test_initial_apply_bulk_update_and_automatic_push(self):
        blocks = re.findall(r"```\w+\n(.*?)```", GUIDE.read_text(), re.S)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            sandbox = root / "sandbox"
            sandbox.mkdir()
            env = dict(
                os.environ, HOME=str(sandbox), XDG_CONFIG_HOME=str(sandbox / ".config"),
                GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_COUNT="0",
                GIT_AUTHOR_NAME="Guide Test", GIT_COMMITTER_NAME="Guide Test",
                GIT_AUTHOR_EMAIL="guide@example.invalid",
                GIT_COMMITTER_EMAIL="guide@example.invalid", GIT_TERMINAL_PROMPT="0",
            )

            def run(command):
                result = subprocess.run(command, env=env, text=True,
                                        capture_output=True, timeout=20)
                self.assertEqual(result.returncode, 0, result.stderr)
                return result.stdout

            def machine(name):
                folder = root / name
                folder.mkdir()
                home = folder / "home"
                home.mkdir()
                config_dir = folder / "config"
                config_dir.mkdir()
                config = config_dir / "chezmoi.toml"
                config.write_text("")
                source = folder / "source"
                cli = ["chezmoi", "--config", str(config), "--source", str(source),
                       "--destination", str(home), "--cache", str(folder / "cache"),
                       "--persistent-state", str(folder / "state.boltdb"),
                       "--use-builtin-git=false", "--no-tty"]
                return source, home, config, cli

            def documented(cli, block, replacements=None):
                for line in block.splitlines():
                    if not line.strip() or line.startswith("#"):
                        continue
                    for old, new in (replacements or {}).items():
                        line = line.replace(old, new)
                    args = shlex.split(line)
                    self.assertEqual(args[0], "chezmoi")
                    run(cli + args[1:])

            remote = root / "remote.git"
            run(["git", "init", "--bare", "--initial-branch=main", str(remote)])
            source_a, home_a, config_a, cli_a = machine("computer-a")
            source_b, home_b, _, cli_b = machine("computer-b")
            source_a.mkdir()
            run(["git", "init", "--initial-branch=main", str(source_a)])
            run(["git", "-C", str(source_a), "remote", "add", "origin", str(remote)])
            data = source_a / ".chezmoidata.yaml"
            data.write_text(blocks[1])
            primary = "private_dot_friend-ai.env.tmpl"
            mirror = "private_dot_friend-mirror.env.tmpl"
            for name in (primary, mirror):
                (source_a / name).write_text(blocks[2])
            run(cli_a + ["git", "add", ".chezmoidata.yaml", primary, mirror])
            run(cli_a + ["git", "--", "commit", "-m", "Seed sample settings"])
            run(cli_a + ["git", "--", "push", "-u", "origin", "main"])

            # The public URL is replaced by a local repo; no network or real home is used.
            documented(cli_b, blocks[9], {
                "https://github.com/YOUR_NAME/dotfiles.git": remote.as_uri(),
            })
            targets = (".friend-ai.env", ".friend-mirror.env")
            for name in targets:
                self.assertEqual((home_b / name).read_text(), blocks[4])

            data.write_text(blocks[1].replace("friend-ai", "shared-ai"))
            documented(cli_a, blocks[10])
            for name in targets:
                self.assertIn('APP_NAME="shared-ai"', (home_a / name).read_text())
                self.assertIn('APP_NAME="friend-ai"', (home_b / name).read_text())
            documented(cli_b, blocks[11])
            for name in targets:
                self.assertIn('APP_NAME="shared-ai"', (home_b / name).read_text())

            # Test the guide's actual TOML options with a non-secret plain file.
            config_a.write_text(blocks[13])
            ordinary = home_a / ".friend-settings.conf"
            ordinary.write_text("theme=green\n")
            run(cli_a + ["add", str(ordinary)])
            source_ref = run(["git", "-C", str(source_a), "rev-parse", "HEAD"])
            remote_ref = run(["git", "--git-dir", str(remote), "rev-parse", "main"])
            self.assertEqual(source_ref, remote_ref, "add must automatically commit and push")
            self.assertEqual(run(["git", "-C", str(source_a), "show",
                                  "HEAD:dot_friend-settings.conf"]), "theme=green\n")
            self.assertFalse((home_b / ordinary.name).exists(), "Other machines still need update")
            documented(cli_b, blocks[11])
            self.assertEqual((home_b / ordinary.name).read_text(), ordinary.read_text())


if __name__ == "__main__":
    unittest.main()
