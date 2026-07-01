---
name: ㅇㅇ
description: Hangul-mode alias for dd. Drop the current OS clipboard text or image into Codex through LazyCopy.
argument-hint: "[클립보드에 대한 요청, 선택]"
user-invocable: true
---

# ㅇㅇ

Use this skill as the Korean shorthand alias for `dd`.

Run LazyCopy with the same behavior as `dd`:

```sh
ㅇㅇ "<user message>"
```

If the user gives no message, use:

```text
Use the latest clipboard content as context.
```

Do not expose AppShot as a skill command. AppShot is installed as the Windows `Shift+Space` hotkey and runs without a separate skill invocation.
