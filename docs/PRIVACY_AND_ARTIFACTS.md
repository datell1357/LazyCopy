# Privacy and Artifacts

LazyCopy is a local handoff tool. It prepares clipboard or window context on the user's machine so Codex CLI, Codex Desktop, or Claude Code can use that context.

## What LazyCopy May Write

Depending on the command, LazyCopy may create these local artifacts:

File | Purpose
--- | ---
`capture.png` | A captured window, region, fullscreen image, or clipboard image.
`clipboard.txt` | Raw clipboard text for the selected AI agent to read.
`manifest.json` | Metadata about the local artifact.

By default, successful non-dry-run AppShot handoffs clean up transient capture artifacts after copying and pasting. `dd` dry-runs keep artifacts so the user can inspect what would be sent.

## Redaction Rules

LazyCopy must not print raw clipboard text in JSON stdout or manifest previews.

Expected redactions:

- `dd.args` uses `<prompt-with-clipboard-text:redacted>` for text payloads.
- `manifest.json` uses `<clipboard-text:redacted>` for `textPreview`.
- Absolute image paths in attach payloads are reduced to filenames where possible.

The raw clipboard text is still stored in `clipboard.txt` when text handoff is needed. That file exists so the selected local agent can read the content.

## What LazyCopy Does Not Do By Itself

LazyCopy does not upload artifacts to a LazyCopy server. It does not submit a Codex Desktop message after AppShot paste. It does not make an external network request on behalf of AppShot.

The selected AI tool may process the artifact after LazyCopy hands it off. That behavior is governed by Codex, Claude Code, and the user's local configuration.

## User Checks

Run this smoke test to confirm redaction:

```powershell
Set-Clipboard "LazyCopy private clipboard smoke test"
dd "Use this context" --dry-run --prefer text --json
```

Check:

- stdout does not contain the raw clipboard text.
- `manifest.json` does not contain the raw clipboard text.
- `clipboard.txt` contains the raw clipboard text for the selected agent.
