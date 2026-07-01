<div align="center">

# LazyCopy

Stop pasting walls of context. Let Codex use the window or clipboard you already have.

Windows-first AppShot + `dd` for Codex: press one hotkey to send the active window into Codex Desktop, or type one short `dd` message to hand over the latest clipboard text/image.

<p>
  <a href="#trust--setup"><img src="https://img.shields.io/badge/Windows-first-0078D4" alt="Windows first"></a>
  <a href="#install-from-codex-desktop"><img src="https://img.shields.io/badge/Codex-Desktop%20%2B%20CLI-111111" alt="Codex Desktop and CLI"></a>
  <a href="#appshot"><img src="https://img.shields.io/badge/AppShot-Shift%2BSpace-5B8DEF" alt="AppShot Shift+Space"></a>
  <a href="#dd"><img src="https://img.shields.io/badge/dd-%2Fdd%20%7C%20%24dd%20%7C%20%E3%85%87%E3%85%87-0A7F64" alt="dd commands"></a>
  <a href="#dd-attribution"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
  <a href="https://github.com/datell1357/LazyCopy/stargazers"><img src="https://img.shields.io/github/stars/datell1357/LazyCopy?color=F0B72F" alt="GitHub stars"></a>
</p>

<sub><a href="#install">Install</a> · <a href="#start-here">Start here</a> · <a href="#pick-by-the-moment">Pick by the moment</a> · <a href="#trust--setup">Trust & setup</a> · <a href="#commands">Commands</a></sub>

</div>

---

## Install

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

The installer does five things:

- Registers this skill as `$dd` and `$ㅇㅇ`.
- Installs `/dd` and `/ㅇㅇ` as Codex prompts.
- Installs `/dd` and `/ㅇㅇ` as Claude Code commands.
- Installs `dd` and `ㅇㅇ` as terminal commands.
- Installs and starts the Windows `Shift+Space` AppShot hotkey listener.

No separate AppShot skill call is required.

### Install from Codex Desktop

Open Codex Desktop and paste this message:

```text
Install LazyCopy from https://github.com/datell1357/LazyCopy.git for Windows.
Clone or update it at ~/.codex/skills/dd, run npm --prefix ~/.codex/skills/dd run install-user, then verify dd --help, ~/.codex/prompts/dd.md, ~/.codex/prompts/ㅇㅇ.md, ~/.claude/commands/dd.md, and ~/.claude/commands/ㅇㅇ.md.
After install, Shift+Space should be the AppShot hotkey and dd should be available as Codex /dd, $dd, /ㅇㅇ, $ㅇㅇ; Claude Code /dd, /ㅇㅇ; and terminal dd, ㅇㅇ.
```

Start a fresh Codex thread after install.

### Install from Codex CLI

```powershell
codex exec -C $HOME --skip-git-repo-check 'Install LazyCopy from https://github.com/datell1357/LazyCopy.git for Windows. Clone or update it at ~/.codex/skills/dd, run npm --prefix ~/.codex/skills/dd run install-user, then verify dd --help, ~/.codex/prompts/dd.md, ~/.codex/prompts/ㅇㅇ.md, ~/.claude/commands/dd.md, and ~/.claude/commands/ㅇㅇ.md. After install, Shift+Space should be the AppShot hotkey and dd should be available as Codex /dd, $dd, /ㅇㅇ, $ㅇㅇ; Claude Code /dd, /ㅇㅇ; and terminal dd, ㅇㅇ.'
```

---

## Start here

> Two handoffs, kept separate: AppShot is the installed hotkey; `dd` is the clipboard command.

### AppShot

Press:

```text
Shift+Space
```

Expected behavior:

- LazyCopy captures the active Windows window.
- LazyCopy copies the capture as a PNG.
- LazyCopy focuses Codex Desktop.
- LazyCopy pastes the image into the Codex input.
- LazyCopy does not submit the message.

The normal Windows hotkey path performs capture, clipboard update, and paste in one PowerShell helper process. The installer starts the listener in the background and writes a hidden Startup launcher so no PowerShell or cmd window should remain open after install.

Codex Desktop must already be running with a visible window for the paste step. If it is closed, the hotkey listener still fires, but the paste command cannot find a Codex window.

If `Shift+Space` appears silent, run the listener in the foreground:

```powershell
dd appshot hotkey run --key shift+space --app Codex
```

It should print `LazyCopy hotkey listening: shift+space`. Registration failures and key presses are also written to:

```text
%LOCALAPPDATA%\LazyCopy\appshot-hotkey.log
```

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
- On Codex surfaces, LazyCopy uses Claude Code only when the message explicitly asks for Claude.
- The user does not need to pass `--agent`, `--prompt`, `--prefer`, or other flags.

In Claude Code CLI, use:

```text
/dd 이 클립보드 내용을 보고 이어서 작업해줘
/ㅇㅇ 이 클립보드 내용을 보고 이어서 작업해줘
```

Claude Code commands capture the clipboard into the current Claude session. They do not require `--agent claude`.

---

## Pick by the moment

If you need to... | Use this
--- | ---
Show Codex the current app window | Press `Shift+Space`
Ask about the latest clipboard image | Type `/dd ...`, `$dd ...`, `dd ...`, or `ㅇㅇ ...`
Ask about copied text without flooding chat | Type `/dd ...`, `$dd ...`, `dd ...`, or `ㅇㅇ ...`
Use Claude Code CLI | Type `/dd ...` or `/ㅇㅇ ...` inside Claude Code
Launch Claude from a normal terminal | Run `dd "..." --agent claude`
Reinstall or diagnose the hotkey | Use `dd appshot hotkey ...`

---

## Trust & setup

LazyCopy is intended for Windows 10 or Windows 11 with Git, Node.js, Codex CLI, and Codex Desktop installed.

- AppShot is only the installed hotkey; it is not a chat command.
- `dd` keeps raw clipboard text in the local artifact file so the selected agent can read it, while stdout and manifest previews are redacted.
- No Windows permission setup is documented here; the helper scripts run locally through PowerShell.
- The Windows implementation uses PowerShell with `-ExecutionPolicy Bypass` for local helper scripts.

---

## Commands

### Update

```powershell
git -C "$HOME\.codex\skills\dd" pull --ff-only
npm --prefix "$HOME\.codex\skills\dd" run install-user
```

### Direct CLI usage

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

### Smoke test

```powershell
dd --help
npm --prefix "$HOME\.codex\skills\dd" test
Test-Path "$HOME\.codex\prompts\dd.md"
Test-Path "$HOME\.codex\prompts\ㅇㅇ.md"
Test-Path "$HOME\.claude\commands\dd.md"
Test-Path "$HOME\.claude\commands\ㅇㅇ.md"
```

Then verify `dd` privacy behavior:

```powershell
Set-Clipboard "LazyCopy private clipboard smoke test"
dd "Use this context" --dry-run --prefer text --json
```

Expected `dd` dry-run behavior:

- `dd.args` contains `<prompt-with-clipboard-text:redacted>`.
- JSON output and `manifest.json` do not contain raw clipboard text.
- The artifact `clipboard.txt` keeps raw clipboard text so the selected agent can read it.

---

## dd Attribution

LazyCopy's `dd` clipboard workflow is adapted from fivetaku's `dd`, distributed through the `fivetaku/gptaku_plugins` collection.

- Source collection: https://github.com/fivetaku/gptaku_plugins
- Upstream `dd` source: https://github.com/fivetaku/dd
- Upstream license: MIT License
- Upstream copyright: Copyright (c) 2026 fivetaku

LazyCopy keeps this attribution because the upstream `dd` workflow and command surface inspired the local clipboard text/image handoff used here. The upstream MIT notice is preserved in `THIRD_PARTY_NOTICES.md`.

## License

MIT
