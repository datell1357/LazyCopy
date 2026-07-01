# LazyCopy

LazyCopy is a standalone skill and local CLI for moving visual or clipboard context into Codex Desktop, Codex CLI, or Claude Code.

It can:

- AppShot: capture the current macOS window, copy the PNG, and paste it into Codex Desktop.
- AppShot: run a `Ctrl+Space` hotkey that triggers the current-window desktop flow.
- dd: package the latest clipboard image or text for a CLI agent.
- dd: send clipboard context to Codex CLI or Claude Code with separate agent adapters.

## Install As A Codex Skill

Copy or link this repository into your Codex skills directory:

```sh
mkdir -p ~/.codex/skills
ln -s /path/to/LazyCopy ~/.codex/skills/LazyCopy
```

Then invoke the skill in Codex with `$LazyCopy`.

## CLI Use

Run the local CLI directly from the repository.

Capture the current front window and paste it into Codex Desktop:

```sh
node ./bin/lazycopy.js appshot desktop --mode active-window --paste-to Codex
```

Keep the AppShot capture artifact after a successful handoff:

```sh
node ./bin/lazycopy.js appshot desktop --keep --json
```

Send the latest clipboard content to Codex CLI:

```sh
node ./bin/lazycopy.js dd --agent codex --prompt "Use this context"
```

Send the latest clipboard content to Claude Code:

```sh
node ./bin/lazycopy.js dd --agent claude --prompt "Use this context"
```

Run a global hotkey until the process exits:

```sh
node ./bin/lazycopy.js appshot hotkey run --key control+space --app Codex
```

Install the hotkey as a LaunchAgent:

```sh
node ./bin/lazycopy.js appshot hotkey install --key control+space --app Codex
```

By default, AppShot and dd delete transient artifacts after a successful handoff. Pass `--keep` when you want to preserve `capture.png`, `clipboard.txt`, and `manifest.json` for debugging.

The AppShot desktop and hotkey flows require macOS Screen Recording permission for capture, and Accessibility permission for sending paste to Codex Desktop.
