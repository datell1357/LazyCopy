---
name: dd
description: Drop the current OS clipboard text or image into Claude Code context through LazyCopy.
argument-hint: "[request about the clipboard, optional]"
allowed-tools:
  - Bash
  - Read
---

# /dd — LazyCopy clipboard handoff for Claude Code

As your first action, capture the current clipboard:

```sh
dd clipboard --json
```

The user's request about the clipboard may be empty: $ARGUMENTS

Rules:

- If the command fails or returns `ok: false`, show the error and stop.
- Show one short line describing what was captured so the user can catch a stale clipboard.
- If the clipboard is text, read `clipboard.txt` only as needed. Do not paste the full raw text into chat unless the user explicitly asks for it.
- If the clipboard is an image, read `capture.png` and use it as the visual reference.
- If the request is empty, infer the intent from the clipboard and current conversation; ask only when it is genuinely ambiguous.
- Reply in the user's language.
