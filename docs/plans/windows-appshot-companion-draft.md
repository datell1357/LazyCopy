---
slug: windows-appshot-companion
status: planned
intent: clear
class: architecture
review_required: false
pending-action: none
approach: Build dd as one OMO Codex component and one user-facing skill that also covers Windows AppShot-like capture. Capture locally on Windows, save a dd-style PNG + manifest, attach appshot.png through supported Codex CLI image input for v1, and leave Codex Desktop current-thread injection as a later experimental milestone.
---

# Draft: windows-appshot-companion

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->
C1 | Windows capture runtime can capture active window, region, and full screen into PNG | active | Microsoft Windows.Graphics.Capture docs; prior SYNTHESIS.md
C2 | Capture artifact contract writes appshot.png plus manifest.json under dd-style run directory | active | .omo/ulw-research/20260630-175353-dd-codex-plan/SYNTHESIS.md
C3 | Stable Codex delivery path attaches PNG through CLI image input and resume-last flow | active | OpenAI Codex CLI features/reference; prior SYNTHESIS.md
C4 | OMO Codex packaging exposes the command as a plugin component bin and optional skill/hook context | active | oh-my-openagent-ulw-resume-snapshot/packages/omo-codex/AGENTS.md:30-49
C5 | Codex Desktop current-thread app-server injection remains an explicit experimental bridge | deferred | OpenAI Codex app-server docs; prior SYNTHESIS.md
C6 | Verification covers unit contracts, plugin aggregation, package layout, isolated CODEX_HOME QA, and Windows native capture smoke | active | oh-my-openagent-ulw-resume-snapshot/packages/omo-codex/AGENTS.md:5-22

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->
Command/component boundary | Use one dd-owned component and one dd skill that can expose both omo-dd and omo-appshot command flows | User approved that dd should perform the dd role and appshot-like role together | yes, before implementation
Supported v1 delivery | Treat codex resume --last --image/-i <png> as the supported path | It is documented image input and avoids claiming Windows native Appshots | yes
Desktop direct injection | Do not include --desktop-current in v1; document it only as a later experimental milestone | User prefers appshot.png first and does not need current-thread Desktop injection now | yes
Capture implementation | Use Windows.Graphics.Capture first, with support checks and user-consent picker where required | It is the documented Windows capture API and preserves consent boundary | yes
Hook behavior | Hooks may add manifest/context, but must not claim to attach pixels unless the image is actually attached | Prevents false Appshot parity claims | yes
QA standard | Follow packages/omo-codex isolated CODEX_HOME rules and record evidence under .omo/evidence | Repo instruction for Codex-connected changes | no

## Findings (cited - path:lines)
OpenAI Appshots are documented as macOS Codex app context, not Windows native Appshots:
- https://developers.openai.com/codex/appshots

OpenAI Windows Codex app is documented separately:
- https://developers.openai.com/codex/app/windows

Codex CLI supports image input and command-line image attachment:
- https://developers.openai.com/codex/cli/features
- https://developers.openai.com/codex/cli/reference

Codex app-server is a rich-client protocol surface; treat WebSocket/direct injection as experimental unless verified:
- https://developers.openai.com/codex/app-server

Windows capture should use the Microsoft capture API and support checks:
- https://learn.microsoft.com/en-us/uwp/api/windows.graphics.capture
- https://learn.microsoft.com/en-us/windows/apps/develop/media-authoring-processing/screen-capture
- https://learn.microsoft.com/en-us/uwp/api/windows.graphics.capture.graphicscapturesession

Prior dd/AppShot-like extension already scoped capture, manifest, resume-last CLI attach, and experimental desktop injection:
- .omo/ulw-research/20260630-175353-dd-codex-plan/SYNTHESIS.md

Target repo and mandatory Codex QA:
- oh-my-openagent-ulw-resume-snapshot/AGENTS.md:1-49
- oh-my-openagent-ulw-resume-snapshot/packages/omo-codex/AGENTS.md:5-49

Component build and plugin seams:
- oh-my-openagent-ulw-resume-snapshot/packages/omo-codex/plugin/package.json:8-30
- oh-my-openagent-ulw-resume-snapshot/packages/omo-codex/plugin/scripts/build-components.mjs:14-57
- oh-my-openagent-ulw-resume-snapshot/packages/omo-codex/plugin/scripts/sync-skills.mjs:13-20,222-244
- oh-my-openagent-ulw-resume-snapshot/packages/omo-codex/plugin/.codex-plugin/plugin.json:21-45

Windows hook/commandWindows trust and validation seams:
- oh-my-openagent-ulw-resume-snapshot/packages/omo-codex/src/install/codex-hook-trust.ts:60-83
- oh-my-openagent-ulw-resume-snapshot/script/lazycodex-marketplace-validation.ts:127-143
- oh-my-openagent-ulw-resume-snapshot/packages/omo-codex/src/install/codex-hook-trust.test.ts:41-90

Packaging/bin test seams:
- oh-my-openagent-ulw-resume-snapshot/package.json:32-38
- oh-my-openagent-ulw-resume-snapshot/packages/omo-codex/plugin/test/component-bin-names.test.mjs:9-65
- oh-my-openagent-ulw-resume-snapshot/packages/omo-codex/src/install/codex-cache-bins.test.ts:435-480
- oh-my-openagent-ulw-resume-snapshot/script/package-layout.test.ts:10-19,191-213

## Decisions (with rationale)
Decision D1: put the implementation under the dd surface, with one dd skill covering both dd workflows and AppShot-like capture.
Rationale: user wants dd to perform the dd role and appshot-like role together. This keeps manifest schema, retention, redaction, and Codex attach paths together.

Recommended decision D2: v1 must be honest about support level: "Windows AppShot-like companion", not "Windows native Appshots".
Rationale: OpenAI docs confirm macOS Appshots, while Windows delivery should use documented CLI image input unless/until Desktop app-server injection is proven.

Decision D3: app-server current-thread injection is not v1; it is a later experimental milestone after the stable appshot.png path.
Rationale: user wants appshot.png first. A broken direct injection path would be worse than a reliable image attachment path, and Windows Desktop QA is the required proof.

Recommended decision D4: capture QA must happen on Windows, even if most packaging/unit tests can run on this Mac.
Rationale: Windows.Graphics.Capture support, picker behavior, permissions, cursor/border flags, and active-window semantics are platform behavior.

## Scope IN
Windows companion CLI:
- omo-appshot capture --json
- omo-appshot --resume last "<prompt>"
- no --desktop-current implementation in v1; reserve the concept for a later experimental milestone

Capture modes:
- active window
- selected region
- full screen/display

Artifact format:
- appshot.png
- manifest.json with source, capture mode, timestamp, dimensions, redacted app/window metadata, and Codex attach status

OMO integration:
- component workspace registration
- component bin packaging
- one component-local dd skill covering dd and appshot-like command flows
- optional hook only for context/manifest, not pixel injection

Verification:
- CLI argument parsing and manifest tests
- command construction tests for Codex image attach/resume-last
- package/plugin aggregate tests
- Windows capture smoke with saved evidence
- isolated CODEX_HOME Codex QA per repo policy

## Scope OUT (Must NOT have)
Must not claim official Windows Appshots support.
Must not depend on an undocumented hidden Appshot protocol for the supported v1 path.
Must not let a hook imply the model received image pixels when only manifest text was injected.
Must not implement --desktop-current in v1.
Must not change unrelated OMO components or refactor installer architecture.
Must not touch the user's real ~/.codex/config.toml during QA.

## Open questions
Resolved Q1. Component boundary: use one dd-owned component and one dd skill; do not split appshot into a separate skill/component for v1.

Resolved Q2. Desktop bridge support claim: v1 only attaches appshot.png through supported image input; --desktop-current is a future experimental idea.

## Approval gate
status: planned
approval-request: resolved by user; executable implementation plan written to .omo/plans/windows-appshot-companion.md.
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
