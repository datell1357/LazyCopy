# dd support for Codex CLI and Windows Codex Desktop

Date: 2026-06-30
Upstream snapshots:
- fivetaku/gptaku_plugins: 057e46423b14daf08566ad73b4154371169229ff
- fivetaku/dd: b3493ee14d855dc316ed441b03563a4b980744cd
- local Codex CLI: codex-cli 0.142.4

## Decision

Implement dd for Codex as a two-layer feature:

1. In-session skill and hook path:
   - Trigger with a Codex skill name such as `$dd`.
   - Optionally detect `/dd`, `dd`, or Korean alias in UserPromptSubmit.
   - Capture clipboard into `~/dd/<date>/<id>/`.
   - Inject only a manifest and short redacted preview through UserPromptSubmit additionalContext.
   - Let the agent read saved text files by size policy.

2. External launcher path:
   - Provide `omo-dd` or equivalent.
   - Capture clipboard first.
   - For images, call `codex -i <image> <prompt>` or `codex resume --last -i <image> <prompt>`.
   - For text, pass the manifest path and preview, not the full log.
   - This path is required for closest image parity because command-line `--image` attaches image pixels before model processing.

Do not base the implementation on Codex custom slash prompts. Official Codex docs mark custom prompts as deprecated and recommend skills instead.

## Why not a single `/dd` clone

Claude Code dd works because a slash command can run a capture script, read the skill policy, then use Claude's runtime to inspect saved text or image content.

Codex has the pieces, but the boundary differs:
- Codex hooks can inject text additionalContext at UserPromptSubmit.
- Codex CLI supports `--image/-i` for initial prompt image attachments.
- A hook that runs after the user submits text can inject manifest text, but it cannot by itself convert a saved image path into an already-attached image prompt payload in stock CLI.

So text/log parity fits the hook path; image parity needs the launcher path unless the active desktop/app-server protocol exposes an image message endpoint.

## Upstream dd mechanism

The upstream dd plugin is composed of:
- Marketplace metadata in `fivetaku/gptaku_plugins`.
- Claude command wrappers `commands/dd.md` and `commands/ㅇㅇ.md`.
- Skill policy in `skills/dd/SKILL.md`.
- Capture runtime in `skills/dd/scripts/dd_clipboard.py`.
- First-run setup and update notification scripts under `setup/`.

Runtime flow:
1. User copies text, image, or takes a screenshot.
2. User runs `/dd` or `/ㅇㅇ`.
3. Command wrapper runs first-run setup, then `dd_clipboard.py --json`.
4. Script creates `~/dd/<date>/<time-uuid>/`.
5. Text becomes `content.txt`; image becomes `image.png`; manifest becomes `manifest.json`.
6. Preview is redacted and truncated.
7. Skill decides whether to read, summarize, delegate, ask confirmation, or act.

Key contract:
- Always emit one JSON object.
- `ok` false on empty or unsupported clipboard.
- `primary` prefers image when both image and text are present.
- `size_class` drives small/medium/large/huge reading strategy.
- Raw cache is local and not redacted; previews are redacted.

## Local OMO Codex integration points

Add a new component:
- `packages/omo-codex/plugin/components/dd/`
- Register workspace in `packages/omo-codex/plugin/package.json`.
- Build through `plugin/scripts/build-components.mjs`.

Add a skill:
- Source path: `components/dd/skills/dd`.
- Add `["dd", "components/dd/skills/dd"]` to `plugin/scripts/sync-skills.mjs`.
- Update expected skill lists in plugin tests.

Add an optional hook:
- Component-local `components/dd/hooks/hooks.json`.
- Aggregate hook entry in `.codex-plugin/plugin.json` and generated aggregate hooks.
- UserPromptSubmit command shape should match existing OMO components:
  `node "${PLUGIN_ROOT}/dist/cli.js" hook user-prompt-submit`.
- Output JSON should use `hookSpecificOutput.hookEventName = "UserPromptSubmit"` and `additionalContext`.

Windows handling:
- If a different Windows command is required, use `commandWindows`.
- Existing hook trust code selects `commandWindows` on win32.
- Add hook-target tests covering `commandWindows`.

## Implementation phases

Phase 1: Capture runtime
- Port or wrap `dd_clipboard.py`.
- Preferred for OMO: TypeScript runtime with Node child_process adapters, to match existing component style and avoid a Python dependency on Windows.
- Preserve manifest schema, redaction, size classes, retention, and cache layout.
- Platform adapters:
  - macOS: `pbpaste`, `osascript`, optional `pngpaste`, `sips`.
  - Windows native: PowerShell STA, `Get-Clipboard -Raw`, `System.Windows.Forms.Clipboard`.
  - WSL2: PowerShell bridge plus WSL path conversion where needed.
  - Linux: `wl-paste`, `xclip`, `xsel`.

Phase 2: Codex skill
- Add `dd/SKILL.md`.
- Replace Claude-specific tool names and subagent model pins with Codex-native guidance.
- Define text reading rules by size.
- Define image limitation clearly: if invoked inside a running session, use saved path only when the active harness can inspect local images; otherwise ask user to rerun through `omo-dd --resume`.

Phase 3: UserPromptSubmit hook
- Detect exact triggers: `$dd`, `/dd`, `dd`, Korean alias, and clear natural-language clipboard references.
- Run capture once.
- Inject a compact context block:
  - manifest path
  - primary kind/path/size_class
  - redacted preview
  - routing instructions
- Do not inject raw long text.
- Keep hook timeout low and fail soft if clipboard capture hangs or is unsupported.

Phase 4: CLI launcher
- Add `omo-dd` bin.
- Modes:
  - `omo-dd "request"`: start `codex` with captured context.
  - `omo-dd --resume last "request"`: run `codex resume --last`.
  - `omo-dd --exec "request"`: run `codex exec` for scripted workflows.
- If primary item is image, pass `-i <image.png>`.
- If text, pass prompt text containing manifest path and preview.
- For Windows Desktop, provide `omo-dd.ps1` as a native entrypoint and document Desktop limitations until app-server image message support is confirmed.

Phase 5: Desktop bridge
- First MVP: Windows users run `omo-dd` from integrated terminal or shell.
- Optional later: inspect app-server/remote-control protocol for an authenticated "new prompt with image attachment" endpoint.
- Only claim Desktop one-click parity after an actual Desktop flow attaches screenshot pixels and the model can describe them.

## Windows AppShot-like extension

Official Codex Appshots are currently documented as a Mac app context feature. Windows parity should be built as an AppShot-like companion flow, not as a claim that the same native feature exists on Windows.

Target experience:
- User presses a hotkey while any Windows app is focused.
- The focused window, selected region, or full screen is captured.
- The capture is stored beside the dd manifest.
- The screenshot and a short user prompt are sent to the active or most recent Codex Desktop thread.

Recommended architecture:
1. `omo-appshot` Windows companion:
   - Native PowerShell/.NET or small Node + PowerShell entrypoint.
   - Captures active window with Win32 APIs or region/fullscreen with Windows.Graphics.Capture / System.Drawing fallback.
   - Saves PNG under `~/dd/<date>/<id>/appshot.png`.
   - Writes the same `manifest.json` shape as `dd`, with `kind: "image"` and `source: "appshot"`.
2. Codex delivery path:
   - Stable MVP: call `codex resume --last -i <appshot.png> "<prompt>"`.
   - Desktop-integrated path: connect to Codex app-server remote-control and call `turn/start` with `UserInput` `{ type: "localImage", path: "<appshot.png>" }` plus a text prompt.
   - Current-thread context-only path: `thread/inject_items` can append raw Responses API items, but this must be treated as experimental until verified against a live Windows Codex Desktop app.
3. Desktop readiness:
   - `codex remote-control start --json` must work on the target Windows machine.
   - The app-server protocol generated from the local CLI includes `UserInput` variants `image` and `localImage`, `ContentItem` `input_image`, `turn/start`, and `thread/inject_items`.
   - Local macOS verification could not start remote-control because this machine lacks the standalone Codex install at `~/.codex/packages/standalone/current/codex`.

Implementation phases:
- Phase A: build `omo-appshot capture --json` and verify PNG capture from active window/fullscreen/region on Windows.
- Phase B: wire `omo-appshot --resume last "request"` through `codex resume --last -i`.
- Phase C: add app-server client prototype for `thread/list`, `thread/resume`, and `turn/start` with `localImage`.
- Phase D: only after live Windows Desktop QA passes, add one-command Desktop mode such as `omo-appshot --desktop-current "request"`.

Stop condition:
- A Windows user can press/run the companion command, capture a real non-Codex app window, and have Codex Desktop analyze the visible UI from the screenshot.
- The verification transcript must show that Codex saw the image pixels, not only the saved file path.
- If remote-control is unavailable, the supported fallback remains `codex resume --last -i`.

## Verification

Unit tests:
- Manifest schema.
- Secret redaction before truncation.
- Text size classes.
- Retention cleanup.
- Platform command selection.
- Empty clipboard failure JSON.

Integration tests:
- Hook payload with `$dd` returns UserPromptSubmit additionalContext.
- Hook no-op for unrelated prompts.
- Windows `commandWindows` trust hash path.
- Skill sync includes `dd` and generated `agents/openai.yaml`.

Manual QA:
- macOS text clipboard -> `$dd`.
- macOS screenshot clipboard -> `omo-dd --resume last`.
- Windows native text clipboard -> `$dd`.
- Windows native screenshot from Win+Shift+S -> `omo-dd --resume last`.
- WSL2 clipboard bridge.
- Linux Wayland/X11 fallback.

Stop condition:
- Text/log flow works inside a running Codex session without pasting raw logs.
- Image flow works through CLI `--image` attachment with a copied screenshot.
- Windows native capture works from PowerShell entrypoint.
- No final claim of Desktop parity until Desktop image attachment is verified in the app itself.
