# LazyCopy

LazyCopy is a standalone skill and local CLI for moving visual or clipboard context into Codex Desktop, Codex CLI, or Claude Code.

GitHub URL:

```text
https://github.com/datell1357/LazyCopy.git
```

It can:

- AppShot: capture the current macOS window, copy the PNG, and paste it into Codex Desktop.
- AppShot: run a `Ctrl+Space` hotkey that triggers the current-window desktop flow.
- dd: package the latest clipboard image or text for a CLI agent.
- dd: send clipboard context to Codex CLI or Claude Code with separate agent adapters.

## Install From GitHub

Use this when you want `$LazyCopy` inside Codex and the `lazycopy` command in your shell.

```sh
LAZYCOPY_REPO="https://github.com/datell1357/LazyCopy.git"
LAZYCOPY_DIR="$HOME/.codex/skills/LazyCopy"

mkdir -p ~/.codex/skills

if [ -d "$LAZYCOPY_DIR/.git" ]; then
  git -C "$LAZYCOPY_DIR" pull --ff-only
else
  git clone "$LAZYCOPY_REPO" "$LAZYCOPY_DIR"
fi

npm --prefix "$LAZYCOPY_DIR" link
```

Verify the install:

```sh
lazycopy --help
ls -l ~/.codex/skills/LazyCopy/SKILL.md
```

Then open a new Codex app or CLI session and invoke the skill with:

```text
$LazyCopy
```

## Install From The Codex App

Open Codex Desktop, start a new thread, and paste this request:

```text
Install LazyCopy from https://github.com/datell1357/LazyCopy.git.
Clone or update it at ~/.codex/skills/LazyCopy, run npm --prefix ~/.codex/skills/LazyCopy link, then verify lazycopy --help and ~/.codex/skills/LazyCopy/SKILL.md.
Do not modify any other skill directory.
```

After it finishes, start a fresh Codex thread and use:

```text
$LazyCopy
```

## Install From Codex CLI

You can ask Codex CLI to do the same install from the GitHub URL:

```sh
codex exec -C "$HOME" --skip-git-repo-check 'Install LazyCopy from https://github.com/datell1357/LazyCopy.git. Clone or update it at ~/.codex/skills/LazyCopy, run npm --prefix ~/.codex/skills/LazyCopy link, then verify lazycopy --help and ~/.codex/skills/LazyCopy/SKILL.md. Do not modify any other skill directory.'
```

For a direct terminal install without asking an agent, use the commands in [Install From GitHub](#install-from-github).

## Update

```sh
git -C ~/.codex/skills/LazyCopy pull --ff-only
npm --prefix ~/.codex/skills/LazyCopy link
lazycopy --help
```

## macOS Permissions

AppShot needs macOS permissions for the terminal or Codex host app that launches `lazycopy`:

- Screen Recording: required to capture the current window.
- Accessibility: required to focus Codex Desktop and paste the image.

Grant them in System Settings -> Privacy & Security, then rerun the command that failed.

## CLI Use

After installation, use `lazycopy` from any directory. From a local checkout you can also run `node ./bin/lazycopy.js`.

Capture the current front window and paste it into Codex Desktop:

```sh
lazycopy appshot desktop --mode active-window --paste-to Codex --json
```

Keep the AppShot capture artifact after a successful handoff:

```sh
lazycopy appshot desktop --keep --json
```

Send the latest clipboard content to Codex CLI:

```sh
lazycopy dd --agent codex --prompt "Use this context"
```

Send the latest clipboard content to Claude Code:

```sh
lazycopy dd --agent claude --prompt "Use this context"
```

Run a global hotkey until the process exits:

```sh
lazycopy appshot hotkey run --key control+space --app Codex
```

Install the hotkey as a LaunchAgent:

```sh
lazycopy appshot hotkey install --key control+space --app Codex
```

By default, AppShot and dd delete transient artifacts after a successful handoff. Pass `--keep` when you want to preserve `capture.png`, `clipboard.txt`, and `manifest.json` for debugging.

## Smoke Test

Run these after install:

```sh
lazycopy --help
npm --prefix ~/.codex/skills/LazyCopy test
```

Test dd without launching an agent:

```sh
printf 'LazyCopy dd smoke test' | pbcopy
lazycopy dd --agent codex --dry-run --prefer text --prompt "Use this context" --json
lazycopy dd --agent claude --dry-run --prefer text --prompt "Use this context" --json
```

Expected dd dry-run behavior:

- `dd.args` contains `<prompt-with-clipboard-text:redacted>`.
- JSON output and `manifest.json` do not contain the raw clipboard text.
- The artifact `clipboard.txt` keeps the raw clipboard text so the selected agent can read it.

Test AppShot paste into Codex Desktop:

```sh
lazycopy appshot desktop --mode active-window --paste-to Codex --json
```

Expected AppShot behavior:

- Codex Desktop is focused.
- The current-window PNG is pasted into the input.
- LazyCopy does not submit the Codex message.
- The temporary capture artifact is deleted unless `--keep` is passed.

Test the hotkey foreground listener:

```sh
lazycopy appshot hotkey run --key control+space --app Codex
```

Press `Ctrl+Space` to trigger the AppShot desktop flow. Press `Ctrl+C` in the terminal to stop the listener.

If macOS uses `Ctrl+Space` for input-source switching, disable that shortcut in System Settings -> Keyboard -> Keyboard Shortcuts -> Input Sources, or install LazyCopy with another key such as `control+option+l`.
