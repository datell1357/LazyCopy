# LazyCopy

LazyCopy is a standalone Codex skill and small local CLI for turning a PNG image into a capture artifact. The artifact contains the image plus a JSON manifest with dimensions, SHA-256, capture mode, and the local path Codex can attach.

## Install As A Codex Skill

Copy or link this repository into your Codex skills directory:

```sh
mkdir -p ~/.codex/skills
ln -s /path/to/LazyCopy ~/.codex/skills/LazyCopy
```

Then invoke the skill in Codex with `$LazyCopy`.

## CLI Use

Run the local CLI directly from the repository:

```sh
node ./bin/lazycopy.js --help
node ./bin/lazycopy.js capture --json --fixture-image ./example.png --output-root ./captures
```

The current CLI packages an existing PNG file. Native screen capture is intentionally not claimed until it exists.
