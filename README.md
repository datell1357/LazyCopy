<div align="center">

# LazyCopy

Stop pasting walls of context. Send Codex the window or clipboard you already have.

Windows-first AppShot + `dd` for Codex: press one hotkey to paste the current window into Codex Desktop, or type one short `dd` message to hand over the latest clipboard text or image.

<p>
  <a href="#requirements"><img src="https://img.shields.io/badge/OS-Windows-0078D4" alt="OS Windows"></a>
  <a href="#install-from-codex-desktop"><img src="https://img.shields.io/badge/Platform-Codex%20Desktop%20%2B%20CLI-111111" alt="Codex Desktop and CLI"></a>
  <a href="#appshot"><img src="https://img.shields.io/badge/AppShot-Shift%2BSpace-5B8DEF" alt="AppShot Shift+Space"></a>
  <a href="#dd"><img src="https://img.shields.io/badge/dd-%2Fdd%20%7C%20%24dd%20%7C%20%E3%85%87%E3%85%87-0A7F64" alt="dd commands"></a>
  <a href="#license-and-attribution"><img src="https://img.shields.io/badge/License-MIT-blue" alt="MIT license"></a>
  <a href="https://github.com/datell1357/LazyCopy/stargazers"><img src="https://img.shields.io/github/stars/datell1357/LazyCopy?label=GitHub%20stars&color=F0B72F" alt="GitHub stars"></a>
</p>

<sub>
  <a href="#install">Install</a> ·
  <a href="#start-here">Start here</a> ·
  <a href="#what-gets-installed">What gets installed</a> ·
  <a href="#commands">Commands</a> ·
  <a href="#troubleshooting">Troubleshooting</a> ·
  <a href="#license-and-attribution">License</a>
</sub>

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

After install, start a fresh Codex thread so the installed skill and prompts are reloaded.

### Install From Codex Desktop

Open Codex Desktop and paste this message:

```text
Install LazyCopy from https://github.com/datell1357/LazyCopy.git for Windows.
Clone or update it at ~/.codex/skills/dd, run npm --prefix ~/.codex/skills/dd run install-user, then verify dd --help, ~/.codex/prompts/dd.md, ~/.codex/prompts/ㅇㅇ.md, ~/.claude/commands/dd.md, and ~/.claude/commands/ㅇㅇ.md.
After install, Shift+Space should be the AppShot hotkey and dd should be available as Codex /dd, $dd, /ㅇㅇ, $ㅇㅇ; Claude Code /dd, /ㅇㅇ; and terminal dd, ㅇㅇ.
```

### Install From Codex CLI

```powershell
codex exec -C $HOME --skip-git-repo-check 'Install LazyCopy from https://github.com/datell1357/LazyCopy.git for Windows. Clone or update it at ~/.codex/skills/dd, run npm --prefix ~/.codex/skills/dd run install-user, then verify dd --help, ~/.codex/prompts/dd.md, ~/.codex/prompts/ㅇㅇ.md, ~/.claude/commands/dd.md, and ~/.claude/commands/ㅇㅇ.md. After install, Shift+Space should be the AppShot hotkey and dd should be available as Codex /dd, $dd, /ㅇㅇ, $ㅇㅇ; Claude Code /dd, /ㅇㅇ; and terminal dd, ㅇㅇ.'
```

---

## Start Here

LazyCopy has two separate handoff paths.

Surface | What you do | What LazyCopy does
--- | --- | ---
AppShot | Press `Shift+Space` | Captures the active Windows window and pastes the PNG into Codex Desktop.
`dd` | Type `/dd ...`, `$dd ...`, `dd ...`, or `ㅇㅇ ...` | Reads the latest clipboard image or text and sends it to the selected AI agent.

These two paths are intentionally separate. AppShot is a hotkey, not a chat command. `dd` is the clipboard command, not the screenshot hotkey.

### AppShot

Press:

```text
Shift+Space
```

Expected behavior:

- LazyCopy captures the active Windows window.
- LazyCopy briefly flashes the captured area so you can tell the hotkey fired.
- LazyCopy copies the capture as a PNG.
- LazyCopy focuses Codex Desktop.
- LazyCopy pastes the image into the Codex input.
- LazyCopy does not submit the message.

AppShot is only active while Codex Desktop has a visible window. The installer writes a hidden Windows Startup launcher for a small watcher. The watcher keeps running in the background, starts the hotkey listener when Codex is visible, and stops only that listener when Codex disappears.

This means:

- Codex visible: `Shift+Space` should capture and paste into Codex.
- Codex closed or not visible: the listener should not hold the hotkey for AppShot.
- Reopening Codex should make the watcher start the listener again within a short polling window.

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

- LazyCopy reads the latest clipboard image first.
- If no clipboard image is available, LazyCopy falls back to clipboard text.
- Codex is the default agent.
- Claude Code is used only when you explicitly choose Claude or use the installed Claude Code slash command.
- You normally do not need `--agent`, `--prompt`, `--prefer`, or other flags.

In Claude Code CLI, use:

```text
/dd 이 클립보드 내용을 보고 이어서 작업해줘
/ㅇㅇ 이 클립보드 내용을 보고 이어서 작업해줘
```

Claude Code commands capture the clipboard into the current Claude session. They do not require `--agent claude`.

---

## What Gets Installed

The installer creates or updates these local surfaces:

Installed surface | Location | Purpose
--- | --- | ---
Codex skill | `%USERPROFILE%\.codex\skills\dd` | Makes `$dd`, `$ㅇㅇ`, and natural `dd`/`ㅇㅇ` use available to Codex skill discovery.
Codex prompts | `%USERPROFILE%\.codex\prompts\dd.md`, `%USERPROFILE%\.codex\prompts\ㅇㅇ.md` | Makes `/dd` and `/ㅇㅇ` available in Codex prompt surfaces.
Claude commands | `%USERPROFILE%\.claude\commands\dd.md`, `%USERPROFILE%\.claude\commands\ㅇㅇ.md` | Makes `/dd` and `/ㅇㅇ` available in Claude Code.
Terminal commands | `dd`, `ㅇㅇ`, `lazycopy` through `npm link` | Allows direct CLI use from PowerShell.
AppShot watcher | Windows Startup launcher | Keeps AppShot listener aligned with the Codex Desktop lifecycle.

No separate AppShot skill command is installed. Normal AppShot use is always the installed `Shift+Space` hotkey.

---

## Requirements

LazyCopy is built for Windows 10 or Windows 11.

Required:

- Git
- Node.js and npm
- PowerShell
- Codex CLI
- Codex Desktop for AppShot

Optional:

- Claude Code CLI, only if you want Claude Code `/dd` or `/ㅇㅇ` support.

Not required:

- Windows admin permission
- Windows scheduled-task setup
- Windows service installation
- Registry Run key setup
- A separate AppShot chat command
- Any bundled plugin runtime dependency

The Windows helper scripts run locally through PowerShell. The installer uses PowerShell with `-ExecutionPolicy Bypass` for LazyCopy's local helper scripts.

---

## Commands

### Update

```powershell
git -C "$HOME\.codex\skills\dd" pull --ff-only
npm --prefix "$HOME\.codex\skills\dd" run install-user
```

### Direct CLI Usage

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

Launch Claude Code only when explicitly wanted:

```powershell
dd "Use this context in Claude Code" --agent claude
```

Reinstall the AppShot watcher:

```powershell
dd appshot hotkey install --key shift+space --app Codex
```

Run the hotkey listener directly in the foreground for diagnosis:

```powershell
dd appshot hotkey run --key shift+space --app Codex
```

### Smoke Test

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

Expected dry-run behavior:

- `dd.args` contains `<prompt-with-clipboard-text:redacted>`.
- JSON output and `manifest.json` do not contain raw clipboard text.
- The artifact `clipboard.txt` keeps raw clipboard text so the selected agent can read it.

---

## Troubleshooting

### Shift+Space Does Nothing

First confirm Codex Desktop is open and has a visible window. The AppShot listener is intentionally active only while Codex is visible.

Then check the log:

```text
%LOCALAPPDATA%\LazyCopy\appshot-hotkey.log
```

Useful markers:

Marker | Meaning
--- | ---
`watcher-start` | Startup watcher launched.
`codex-visible` | Watcher detected a visible Codex window.
`listener-started` | Hotkey listener started.
`hotkey-fired` | `Shift+Space` was received.
`command-launched` | Capture/paste command was launched.
`codex-hidden` | Codex is no longer visible.
`listener-stop-requested` | Watcher stopped its own listener child.
`listener-restart` | Watcher is restarting a listener that exited unexpectedly.
`watcher-failed` | The watcher failed before or while managing the listener.
`listener-failed` | The hotkey listener failed.
`command-launch-failed` | The capture/paste helper could not be started.

If the log looks stale or an old listener is still holding the hotkey, reinstall:

```powershell
dd appshot hotkey install --key shift+space --app Codex
```

### The Terminal `dd` Command Is Not LazyCopy

Codex and Claude slash commands are different from your shell command lookup. If `dd --help` does not show LazyCopy, run the installer again, then open a new PowerShell window:

```powershell
npm --prefix "$HOME\.codex\skills\dd" run install-user
dd --help
```

### Codex Gets Text But Not an Image

`dd` checks for a clipboard image first and falls back to clipboard text. If you expected image behavior, copy an actual image to the Windows clipboard and run:

```powershell
dd "이미지를 읽고 설명해줘" --dry-run --json
```

The dry-run JSON should report an image artifact and a `capture.png` path.

More detail:

- [Privacy and artifacts](docs/PRIVACY_AND_ARTIFACTS.md)
- [Windows lifecycle QA checklist](docs/WINDOWS_LIFECYCLE_QA.md)

---

## Boundaries

LazyCopy explicitly does not claim these things:

- It does not install a Windows service.
- It does not use Windows scheduled-task setup.
- It does not require admin elevation.
- It does not submit the Codex message after AppShot paste.
- It does not keep the AppShot listener active while Codex Desktop is closed.
- It does not make Codex Desktop required for `dd`.
- It does not send clipboard artifacts to a remote server by itself.
- It does not replace Codex or Claude Code agent behavior; it packages local clipboard/window context for them.

---

## License And Attribution

LazyCopy is distributed under the MIT License. See [LICENSE](LICENSE).

The `dd` clipboard workflow is adapted from fivetaku's `dd`, distributed through the `fivetaku/gptaku_plugins` collection.

- Source collection: https://github.com/fivetaku/gptaku_plugins
- Upstream `dd` source: https://github.com/fivetaku/dd
- Upstream license: MIT License
- Upstream copyright: Copyright (c) 2026 fivetaku

The upstream MIT notice is preserved in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). LazyCopy is an independent project and is not endorsed by, sponsored by, or affiliated with fivetaku unless explicitly stated by that upstream project.
