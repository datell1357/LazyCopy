# LazyCopy

LazyCopy is a standalone Codex skill and local CLI for moving visual or clipboard context into Codex.

It can:

- Capture the current macOS window, copy the PNG, and paste it into Codex Desktop.
- Package the latest clipboard image or text into a local artifact.
- Resume the latest Codex CLI session with clipboard text in the prompt or a clipboard image attached with `-i`.
- Run a macOS global hotkey that triggers the current-window desktop flow.

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
node ./bin/lazycopy.js desktop --mode active-window --paste-to Codex
```

Package the latest clipboard content:

```sh
node ./bin/lazycopy.js clipboard --json
```

Resume the latest Codex CLI session with the latest clipboard content:

```sh
node ./bin/lazycopy.js codex --resume last --prompt "Use this context"
```

Run a global hotkey until the process exits:

```sh
node ./bin/lazycopy.js hotkey run --key command+shift+l --app Codex
```

Install the hotkey as a LaunchAgent:

```sh
node ./bin/lazycopy.js hotkey install --key command+shift+l --app Codex
```

The desktop and hotkey flows require macOS Screen Recording permission for capture, and Accessibility permission for sending paste to Codex Desktop.
