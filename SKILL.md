# LazyCopy

Use LazyCopy when the user wants to send the current window or latest clipboard content into Codex.

## What This Skill Does

- Captures the current macOS window and can paste it into Codex Desktop.
- Reads the latest clipboard image or text and packages it for an AI agent.
- Resumes the latest Codex CLI session with clipboard text in the prompt or a clipboard image attached.
- Provides a macOS global hotkey runner/installer for the desktop flow.

## Local CLI

From this skill directory:

```sh
node ./bin/lazycopy.js --help
node ./bin/lazycopy.js desktop --mode active-window --paste-to Codex
node ./bin/lazycopy.js clipboard --json
node ./bin/lazycopy.js codex --resume last --prompt "Use this context"
node ./bin/lazycopy.js hotkey run --key command+shift+l --app Codex
```

If macOS blocks capture or paste automation, ask the user to grant Screen Recording or Accessibility permission to the terminal/app running LazyCopy.

## Install

Copy or link the skill directory into Codex:

```sh
mkdir -p ~/.codex/skills
ln -s /path/to/LazyCopy ~/.codex/skills/LazyCopy
```

Then invoke it in Codex with `$LazyCopy`.
