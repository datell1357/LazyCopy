# LazyCopy

LazyCopy is a Windows-first Codex skill and local CLI for two quick actions:

- Press `Shift+Space` to capture the active window and paste it into Codex Desktop.
- Type `/dd ...`, `$dd ...`, `/ㅇㅇ ...`, `$ㅇㅇ ...`, `dd ...`, or `ㅇㅇ ...` to send the latest clipboard content to Codex or Claude Code.

GitHub URL:

```text
https://github.com/datell1357/LazyCopy.git
```

## Install From GitHub

Run this in PowerShell:

```powershell
$repo = "https://github.com/datell1357/LazyCopy.git"
$dir = "$HOME\.codex\skills\dd"

New-Item -ItemType Directory -Force "$HOME\.codex\skills" | Out-Null

if (Test-Path "$dir\.git") {
  git -C $dir pull --ff-only
} else {
  git clone $repo $dir
}

npm --prefix $dir run install-user
```

The installer does four things:

- Registers this skill as `$dd` and `$ㅇㅇ`.
- Installs `/dd` and `/ㅇㅇ` as Codex prompts.
- Installs `dd` and `ㅇㅇ` as terminal commands.
- Installs and starts the Windows `Shift+Space` AppShot hotkey listener.

No separate AppShot skill call is required.

## Install From Codex Desktop

Open Codex Desktop and paste this message:

```text
Install LazyCopy from https://github.com/datell1357/LazyCopy.git for Windows.
Clone or update it at ~/.codex/skills/dd, run npm --prefix ~/.codex/skills/dd run install-user, then verify dd --help, ~/.codex/prompts/dd.md, and ~/.codex/prompts/ㅇㅇ.md.
After install, Shift+Space should be the AppShot hotkey and dd should be available as /dd, $dd, /ㅇㅇ, $ㅇㅇ, dd, and ㅇㅇ.
```

Start a fresh Codex thread after install.

## Install From Codex CLI

Run:

```powershell
codex exec -C $HOME --skip-git-repo-check 'Install LazyCopy from https://github.com/datell1357/LazyCopy.git for Windows. Clone or update it at ~/.codex/skills/dd, run npm --prefix ~/.codex/skills/dd run install-user, then verify dd --help, ~/.codex/prompts/dd.md, and ~/.codex/prompts/ㅇㅇ.md. After install, Shift+Space should be the AppShot hotkey and dd should be available as /dd, $dd, /ㅇㅇ, $ㅇㅇ, dd, and ㅇㅇ.'
```

## Update

```powershell
git -C "$HOME\.codex\skills\dd" pull --ff-only
npm --prefix "$HOME\.codex\skills\dd" run install-user
```

## User-Facing Usage

### AppShot

Press:

```text
Shift+Space
```

AppShot is only the installed hotkey; it is not a chat command.

Expected behavior:

- LazyCopy captures the active Windows window.
- LazyCopy copies the capture as a PNG.
- LazyCopy focuses Codex Desktop.
- LazyCopy pastes the image into the Codex input.
- LazyCopy does not submit the message.

Codex Desktop must already be running with a visible window for the paste step. If it is closed, the hotkey listener still fires, but the paste command cannot find a Codex window.

### dd

Use any of these in Codex Desktop or Codex CLI message input:

```text
/dd 이 클립보드 내용을 보고 이어서 작업해줘
$dd 이 클립보드 내용을 보고 이어서 작업해줘
/ㅇㅇ 이 클립보드 내용을 보고 이어서 작업해줘
$ㅇㅇ 이 클립보드 내용을 보고 이어서 작업해줘
dd 이 클립보드 내용을 보고 이어서 작업해줘
ㅇㅇ 이 클립보드 내용을 보고 이어서 작업해줘
```

Expected behavior:

- LazyCopy reads the latest clipboard image first, then falls back to clipboard text.
- LazyCopy sends image context to Codex CLI with the `-i` image attachment path by default.
- LazyCopy uses Claude Code only when the message explicitly asks for Claude.
- The user does not need to pass `--agent`, `--prompt`, `--prefer`, or other flags.

## Direct CLI Usage

In a Windows terminal, use the short commands directly:

```powershell
dd "이 클립보드 내용을 보고 이어서 작업해줘"
ㅇㅇ "이 클립보드 내용을 보고 이어서 작업해줘"
```

Dry-run without launching an agent:

```powershell
Set-Clipboard "LazyCopy dd smoke test"
dd "Use this context" --dry-run --prefer text --json
```

Claude Code only when explicitly wanted:

```powershell
dd "Use this context in Claude Code" --agent claude
```

Normal AppShot use is always `Shift+Space`; the commands below are only for reinstalling or diagnosing the hotkey.

Reinstall the hotkey:

```powershell
dd appshot hotkey install --key shift+space --app Codex
```

Run the hotkey listener in the foreground:

```powershell
dd appshot hotkey run --key shift+space --app Codex
```

## Smoke Test

```powershell
dd --help
npm --prefix "$HOME\.codex\skills\dd" test
Test-Path "$HOME\.codex\prompts\dd.md"
Test-Path "$HOME\.codex\prompts\ㅇㅇ.md"
```

Then verify dd privacy behavior:

```powershell
Set-Clipboard "LazyCopy private clipboard smoke test"
dd "Use this context" --dry-run --prefer text --json
```

Expected dd dry-run behavior:

- `dd.args` contains `<prompt-with-clipboard-text:redacted>`.
- JSON output and `manifest.json` do not contain raw clipboard text.
- The artifact `clipboard.txt` keeps raw clipboard text so the selected agent can read it.

## Windows Notes

LazyCopy is intended for Windows 10 or Windows 11 with Git, Node.js, Codex CLI, and Codex Desktop installed.

The Windows implementation uses PowerShell with `-ExecutionPolicy Bypass` for local helper scripts.
