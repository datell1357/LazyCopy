# LazyCopy

Use LazyCopy when the user wants to package a local PNG image as a Codex-ready capture artifact.

## What This Skill Does

- Creates a dated capture artifact directory from a PNG file.
- Writes `capture.png` and `manifest.json`.
- Records image dimensions, byte count, SHA-256, capture mode, platform, and the local path Codex can attach.

## Local CLI

From this skill directory:

```sh
node ./bin/lazycopy.js --help
node ./bin/lazycopy.js capture --json --fixture-image /absolute/path/to/image.png --output-root /tmp/lazycopy-captures
```

The CLI currently packages an existing PNG fixture. If the user asks for native screen capture, say that native capture is not implemented in this standalone skill yet and ask for or create a PNG through another available capture surface first.

## Install

Copy or link the skill directory into Codex:

```sh
mkdir -p ~/.codex/skills
ln -s /path/to/LazyCopy ~/.codex/skills/LazyCopy
```

Then invoke it in Codex with `$LazyCopy`.
