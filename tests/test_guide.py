"""Exercise the guide's actual snippets in a disposable chezmoi environment."""
import os
from pathlib import Path
import re
import shlex
import subprocess
import tempfile
import unittest


GUIDE = Path(__file__).resolve().parents[1] / "docs/chezmoi-for-friends.ko.md"


class GuideTest(unittest.TestCase):
    def test_documented_examples(self):
        blocks = re.findall(r"```(\w+)\n(.*?)```", GUIDE.read_text(), re.S)
        yaml = [body for language, body in blocks if language == "yaml"]
        templates = [body for language, body in blocks if language == "text"]
        expected = next(body for language, body in blocks if language == "dotenv")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, home = root / "source", root / "home"
            source.mkdir()
            home.mkdir()
            config = root / "config.json"
            config.write_text("{}\n")
            data = source / ".chezmoidata.yaml"
            data.write_text(yaml[0])
            template = source / "private_dot_friend-ai.env.tmpl"
            template.write_text(templates[0])
            command = ["chezmoi", "--config", str(config), "--source", str(source),
                       "--destination", str(home), "--cache", str(root / "cache"),
                       "--persistent-state", str(root / "state.boltdb")]

            def run(*args, **kwargs):
                return subprocess.run(command + list(args), check=True, text=True,
                                      capture_output=True, **kwargs).stdout

            self.assertEqual(run("execute-template", input=templates[0]), expected)
            run("apply")
            output = home / ".friend-ai.env"
            self.assertEqual(output.read_text(), expected)
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            result = subprocess.run(
                ["bash", "-c", 'set -a; . "$1"; set +a; bash -c \'printf "%s" "$APP_NAME"\'',
                 "guide-test", str(output)], check=True, text=True, capture_output=True)
            self.assertEqual(result.stdout, "friend-ai")
            data.write_text(yaml[0].replace("friend-ai", "changed-ai"))
            self.assertIn('APP_NAME="changed-ai"', run("execute-template", input=templates[0]))

            data.write_text(yaml[0] + yaml[1])
            binaries = root / "bin"
            binaries.mkdir()
            fake_pass = binaries / "pass"
            fake_pass.write_text(
                '#!/bin/sh\n[ "$1" = show ] && [ "$2" = api/openai/api_key ] || exit 1\n'
                "printf '%s\\n' 'fake-test-key' 'extra metadata'\n")
            fake_pass.chmod(0o700)
            env = dict(os.environ, PATH=str(binaries) + os.pathsep + os.environ["PATH"])
            self.assertEqual(run("execute-template", input=templates[1], env=env),
                             'OPENAI_API_KEY="fake-test-key"\n')

            # Case 4: rotating only the fake vault value changes the target, not the source.
            template.write_text(templates[0] + templates[1])
            source_before = (data.read_text(), template.read_text())
            run("apply", str(output), env=env)
            self.assertIn('OPENAI_API_KEY="fake-test-key"', output.read_text())
            fake_pass.write_text(fake_pass.read_text().replace("fake-test-key", "fake-rotated-key"))
            raw_blocks = [body for _, body in blocks]
            rotation = shlex.split(raw_blocks[21].replace("~/", str(home) + "/"))
            self.assertEqual(rotation[0], "chezmoi")
            run(*rotation[1:], env=env)
            self.assertIn('OPENAI_API_KEY="fake-rotated-key"', output.read_text())
            self.assertNotIn("fake-test-key", output.read_text())
            self.assertEqual((data.read_text(), template.read_text()), source_before)


if __name__ == "__main__":
    unittest.main()
