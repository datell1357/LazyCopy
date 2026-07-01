# dd

Use the latest clipboard content as context for the user's message.

Run LazyCopy through the local CLI:

```sh
lazycopy dd --agent codex --prompt "<user message>"
```

Rules:

- Treat all text after `/dd` as the user message.
- Do not ask the user for extra options.
- Use Codex by default.
- Use Claude only when the user explicitly asks for Claude Code.
- Do not invoke AppShot from this prompt. AppShot is handled by the installed `Ctrl+Space` hotkey.
- If the user writes Korean shorthand such as `ㅇㅇ`, treat it as dd.
