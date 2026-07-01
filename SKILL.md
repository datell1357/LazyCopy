# dd

Use this skill when the user wants to send the latest clipboard content to an AI coding agent.

Trigger this skill for:

- `$dd <message>`
- `/dd <message>`
- `$ㅇㅇ <message>`
- `/ㅇㅇ <message>`
- `dd <message>`
- `ㅇㅇ <message>`
- Korean natural language asking to use the current clipboard as context

Do not require the user to mention LazyCopy. Do not ask the user for CLI flags unless they explicitly want to choose an agent.

## Default Behavior

Use Codex by default:

```sh
dd "<user message>"
```

Use Claude Code only when the user explicitly asks for Claude:

```sh
dd "<user message>" --agent claude
```

If the user gives no message, use:

```text
Use the latest clipboard content as context.
```

## AppShot

Do not expose AppShot as a skill command. AppShot is installed as the Windows `Ctrl+Space` hotkey and runs without a separate skill invocation.

When the user asks how AppShot works, explain that pressing `Ctrl+Space` captures the current active window and pastes the image into Codex Desktop.

## Privacy

LazyCopy may write transient `clipboard.txt`, `capture.png`, and `manifest.json` files for handoff. JSON output and manifests must not expose raw clipboard text; raw clipboard text belongs only in `clipboard.txt` for the selected agent to read.
