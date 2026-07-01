# LazyCopy

Use LazyCopy when the user wants to send the current window into Codex Desktop or send the latest clipboard content into a CLI agent.

## What This Skill Does

- AppShot captures the current macOS window and can paste it into Codex Desktop.
- AppShot provides a `Ctrl+Space` global hotkey runner/installer for the desktop flow.
- dd reads the latest clipboard image or text and packages it for a CLI agent.
- dd supports separate Codex CLI and Claude Code handoff paths.

## Local CLI

From this skill directory:

```sh
node ./bin/lazycopy.js --help
node ./bin/lazycopy.js appshot desktop --mode active-window --paste-to Codex
node ./bin/lazycopy.js dd --agent codex --prompt "Use this context"
node ./bin/lazycopy.js dd --agent claude --prompt "Use this context"
node ./bin/lazycopy.js appshot hotkey run --key control+space --app Codex
```

If macOS blocks capture or paste automation, ask the user to grant Screen Recording or Accessibility permission to the terminal/app running LazyCopy.

By default, successful AppShot and dd handoffs delete transient artifacts. Add `--keep` when the user wants to inspect `capture.png`, `clipboard.txt`, or `manifest.json`.

## Install

Copy or link the skill directory into Codex:

```sh
mkdir -p ~/.codex/skills
ln -s /path/to/LazyCopy ~/.codex/skills/LazyCopy
```

Then invoke it in Codex with `$LazyCopy`.
