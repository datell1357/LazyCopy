# dd

Use the latest clipboard content as context for the user's message in Codex.

Run LazyCopy through the short local CLI:

```sh
dd "<user message>"
```

Rules:

- Treat all text after `/dd`, `/ㅇㅇ`, `$dd`, `$ㅇㅇ`, `dd`, or `ㅇㅇ` as the user message.
- Do not ask the user for extra options.
- Use Codex by default.
- Use Claude only when the user explicitly asks for Claude Code. Claude Code CLI also has its own installed `/dd` and `/ㅇㅇ` commands under `~/.claude/commands`.
- Do not invoke AppShot from this prompt. AppShot is handled by the installed `Shift+Space` hotkey.
- If the user writes Korean shorthand such as `ㅇㅇ`, treat it as dd.
