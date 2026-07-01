const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const {
  createCaptureArtifact,
  createTextArtifact,
  DEFAULT_OUTPUT_ROOT,
} = require("./capture");
const { LazyCopyError } = require("./errors");
const platformSystem = require("./platform");
const { hiddenHotkeyStartupCommand } = require("./windows");

const DEFAULT_HOTKEY = "shift+space";
const VALID_AGENTS = new Set(["codex", "claude"]);
const DD_COMMAND_ALIASES = new Set(["dd", "ㅇㅇ", "/dd", "$dd", "/ㅇㅇ", "$ㅇㅇ"]);

const usage = `Usage:
  dd [message] [--agent codex|claude] [--prefer image|text] [--dry-run] [--keep]
  ㅇㅇ [message] [--agent codex|claude] [--prefer image|text] [--dry-run] [--keep]
  /dd <message>      Codex Desktop or Codex CLI message input.
  $dd <message>      Codex skill invocation.
  /ㅇㅇ <message>     Codex Desktop or Codex CLI message input.
  $ㅇㅇ <message>     Codex skill invocation.
  lazycopy appshot capture --json [--fixture-image <png>] [--output-root <dir>] [--mode active-window|region|fullscreen]
  lazycopy appshot desktop [--mode active-window|region|fullscreen] [--paste-to Codex] [--json] [--keep]
  lazycopy appshot hotkey run [--key shift+space] [--app Codex]
  lazycopy appshot hotkey install [--key shift+space] [--app Codex] [--dry-run]

Commands:
  appshot    Capture the current window and hand it to Codex Desktop.
  dd         Package the latest clipboard image or text for Codex CLI or Claude Code.
  ㅇㅇ       Same as dd for Korean natural-language use.

Options:
  --json                 Print machine-readable JSON.
  --fixture-image <png>  PNG file to copy into the artifact.
  --output-root <dir>    Directory where artifacts are written. Defaults to ${DEFAULT_OUTPUT_ROOT}.
  --mode <mode>          active-window, region, or fullscreen.
  --prefer <kind>        image or text for clipboard reads.
  --agent <agent>        codex or claude for dd. Defaults to codex.
  --resume last          Resume or continue the latest CLI-agent session.
  --prompt <text>        Prompt sent with clipboard content.
  --dry-run              Print what would run without launching an agent or installing.
  --keep                 Keep transient artifacts after a successful handoff.
  --paste-to <app>       App name to activate and paste into. Defaults to Codex.
  --no-paste             Capture and copy only; do not activate an app.
  --key <shortcut>       Hotkey such as shift+space or control+space.
  -h, --help             Show this help.
`;

function readFlagValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new LazyCopyError("MISSING_FLAG_VALUE", `Missing value for ${flag}.`);
  }
  return value;
}

function parseFlagArgs(args, defaults = {}) {
  const options = { ...defaults };
  const positional = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--json":
        options.json = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--keep":
        options.keep = true;
        break;
      case "--no-paste":
        options.paste = false;
        break;
      case "--fixture-image":
        options.fixtureImage = readFlagValue(args, index, arg);
        index += 1;
        break;
      case "--output-root":
        options.outputRoot = readFlagValue(args, index, arg);
        index += 1;
        break;
      case "--mode":
        options.mode = readFlagValue(args, index, arg);
        index += 1;
        break;
      case "--prefer":
        options.prefer = readFlagValue(args, index, arg);
        index += 1;
        break;
      case "--agent":
        options.agent = readFlagValue(args, index, arg);
        index += 1;
        break;
      case "--resume":
        options.resume = readFlagValue(args, index, arg);
        index += 1;
        break;
      case "--prompt":
        options.prompt = readFlagValue(args, index, arg);
        index += 1;
        break;
      case "--paste-to":
      case "--app":
        options.appName = readFlagValue(args, index, arg);
        index += 1;
        break;
      case "--key":
        options.key = readFlagValue(args, index, arg);
        index += 1;
        break;
      case "--log-path":
        options.logPath = readFlagValue(args, index, arg);
        index += 1;
        break;
      case "-h":
      case "--help":
        options.help = true;
        break;
      default:
        if (arg.startsWith("--")) {
          throw new LazyCopyError("UNKNOWN_OPTION", `Unknown option ${arg}.`);
        }
        positional.push(arg);
    }
  }

  options.positional = positional;
  return options;
}

function parseArgs(argv) {
  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
    return { command: "help" };
  }

  const command = argv[0];
  if (command === "appshot") {
    const action = argv[1];
    if (!action || action.startsWith("--")) {
      throw new LazyCopyError(
        "MISSING_APPSHOT_ACTION",
        "Expected appshot capture, appshot desktop, or appshot hotkey.",
      );
    }

    if (action === "hotkey") {
      const hotkeyAction = argv[2];
      if (!hotkeyAction || hotkeyAction.startsWith("--")) {
        throw new LazyCopyError(
          "MISSING_HOTKEY_ACTION",
          "Expected appshot hotkey run or appshot hotkey install.",
        );
      }
      return {
        command: "appshot-hotkey",
        action: hotkeyAction,
        options: parseFlagArgs(argv.slice(3), {
          appName: "Codex",
          key: DEFAULT_HOTKEY,
        }),
      };
    }

    if (!["capture", "desktop"].includes(action)) {
      throw new LazyCopyError("UNKNOWN_APPSHOT_ACTION", `Unknown appshot action ${action}.`);
    }

    const defaults = {
      capture: { json: false, mode: "active-window" },
      desktop: { appName: "Codex", json: false, keep: false, mode: "active-window", paste: true },
    }[action];
    const options = parseFlagArgs(argv.slice(2), defaults);
    if (options.positional.length > 0) {
      throw new LazyCopyError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument ${options.positional[0]}.`,
      );
    }
    return { command: `appshot-${action}`, options };
  }

  if (DD_COMMAND_ALIASES.has(command)) {
    const options = parseFlagArgs(argv.slice(1), {
      agent: "codex",
      json: false,
      keep: false,
      prefer: "auto",
      resume: "last",
    });
    if (options.positional.length > 0 && !options.prompt) {
      options.prompt = options.positional.join(" ");
    } else if (options.positional.length > 0) {
      throw new LazyCopyError(
        "UNEXPECTED_ARGUMENT",
        `Unexpected argument ${options.positional[0]}.`,
      );
    }
    return { command: "dd", options };
  }

  if (command === "hotkey") {
    const action = argv[1];
    if (!action || action.startsWith("--")) {
      throw new LazyCopyError("MISSING_HOTKEY_ACTION", "Expected hotkey run or hotkey install.");
    }
    return {
      command: "appshot-hotkey",
      action,
      options: parseFlagArgs(argv.slice(2), { appName: "Codex", key: DEFAULT_HOTKEY }),
    };
  }

  if (!["capture", "clipboard", "codex", "desktop"].includes(command)) {
    throw new LazyCopyError("UNKNOWN_COMMAND", `Unknown command ${command}.`);
  }

  const defaults = {
    capture: { json: false, mode: "active-window" },
    clipboard: { json: false, prefer: "auto" },
    codex: { agent: "codex", json: false, keep: false, prefer: "auto", resume: "last" },
    desktop: { appName: "Codex", json: false, keep: false, mode: "active-window", paste: true },
  }[command];

  const options = parseFlagArgs(argv.slice(1), defaults);
  if (command === "codex" && options.positional.length > 0 && !options.prompt) {
    options.prompt = options.positional.join(" ");
  }
  if (options.positional.length > 0 && command !== "codex") {
    throw new LazyCopyError(
      "UNEXPECTED_ARGUMENT",
      `Unexpected argument ${options.positional[0]}.`,
    );
  }

  return { command, options };
}

function writeJson(stream, payload) {
  stream.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function normalizeError(error) {
  if (error instanceof LazyCopyError) {
    return error;
  }
  return new LazyCopyError("INTERNAL_ERROR", error.message || String(error));
}

async function removeIfExists(filePath) {
  if (filePath) {
    await fs.rm(filePath, { force: true });
  }
}

async function cleanupArtifact(result, options = {}) {
  if (options.keep || !result?.artifactDir) {
    return { kept: true };
  }
  await fs.rm(result.artifactDir, { force: true, recursive: true });
  return { kept: false, deleted: true };
}

async function runCapture(options, system) {
  if (options.fixtureImage) {
    return createCaptureArtifact({
      fixtureImage: options.fixtureImage,
      mode: options.mode,
      outputRoot: options.outputRoot,
      platform: system.platform,
    });
  }

  const tempImage = system.tempPngPath("lazycopy-window");
  try {
    const capture = await system.captureScreenToFile(tempImage, {
      mode: options.mode,
      platform: system.platform,
    });
    return await createCaptureArtifact({
      sourceImage: tempImage,
      mode: options.mode,
      outputRoot: options.outputRoot,
      platform: system.platform,
      source: capture.source,
    });
  } finally {
    await removeIfExists(tempImage);
  }
}

async function runClipboard(options, system) {
  const prefer = options.prefer ?? "auto";
  if (!["auto", "image", "text"].includes(prefer)) {
    throw new LazyCopyError("INVALID_PREFER", "Expected --prefer image or --prefer text.");
  }

  if (prefer !== "text") {
    const tempImage = system.tempPngPath("lazycopy-clipboard");
    try {
      await system.readClipboardImageToFile(tempImage, { platform: system.platform });
      return {
        kind: "image",
        ...(await createCaptureArtifact({
          sourceImage: tempImage,
          mode: "active-window",
          outputRoot: options.outputRoot,
          platform: system.platform,
          source: { type: "clipboard-image", nativeCapture: false },
        })),
      };
    } catch (error) {
      if (prefer === "image") {
        throw normalizeError(error);
      }
    } finally {
      await removeIfExists(tempImage);
    }
  }

  const text = await system.readClipboardText({ platform: system.platform });
  return {
    kind: "text",
    ...(await createTextArtifact({
      text,
      outputRoot: options.outputRoot,
      platform: system.platform,
      source: { type: "clipboard-text" },
    })),
  };
}

function buildCodexArgs(clipboardResult, prompt) {
  const requestedPrompt = prompt || "Use the LazyCopy clipboard content.";
  if (clipboardResult.kind === "image") {
    return ["resume", "--last", "-i", clipboardResult.imagePath, requestedPrompt];
  }

  return [
    "resume",
    "--last",
    `${requestedPrompt}\n\nLazyCopy clipboard text is saved at ${clipboardResult.textPath}. Its content is:\n\n${clipboardResult.text}`,
  ];
}

function buildClaudeArgs(clipboardResult, prompt) {
  const requestedPrompt = prompt || "Use the LazyCopy clipboard content.";
  if (clipboardResult.kind === "image") {
    return [
      "--continue",
      "--print",
      "--add-dir",
      clipboardResult.artifactDir,
      "--",
      `${requestedPrompt}\n\nLazyCopy clipboard image is saved at ${clipboardResult.imagePath}. Use it as the current clipboard visual context.`,
    ];
  }

  return [
    "--continue",
    "--print",
    "--",
    `${requestedPrompt}\n\nLazyCopy clipboard text is saved at ${clipboardResult.textPath}. Its content is:\n\n${clipboardResult.text}`,
  ];
}

function buildDdArgs(agent, clipboardResult, prompt) {
  if (agent === "codex") {
    return buildCodexArgs(clipboardResult, prompt);
  }
  if (agent === "claude") {
    return buildClaudeArgs(clipboardResult, prompt);
  }
  throw new LazyCopyError("UNSUPPORTED_AGENT", "Expected --agent codex or --agent claude.");
}

function ddCommandForAgent(agent, system) {
  if (agent === "codex") {
    return system.codexBin;
  }
  if (agent === "claude") {
    return system.claudeBin;
  }
  throw new LazyCopyError("UNSUPPORTED_AGENT", "Expected --agent codex or --agent claude.");
}

async function runDd(options, system, io) {
  if (options.resume !== "last") {
    throw new LazyCopyError("UNSUPPORTED_RESUME", "Only --resume last is supported.");
  }

  const agent = String(options.agent ?? "codex").toLowerCase();
  if (!VALID_AGENTS.has(agent)) {
    throw new LazyCopyError("UNSUPPORTED_AGENT", "Expected --agent codex or --agent claude.");
  }

  const clipboardResult = await runClipboard(
    { outputRoot: options.outputRoot, prefer: options.prefer ?? "auto" },
    system,
  );

  const promptClipboard =
    clipboardResult.kind === "text"
      ? await fs.readFile(clipboardResult.textPath, "utf8")
      : undefined;

  const args = buildDdArgs(
    agent,
    { ...clipboardResult, text: promptClipboard },
    options.prompt,
  );
  const command = ddCommandForAgent(agent, system);
  if (options.dryRun) {
    return {
      artifact: clipboardResult,
      cleanup: { kept: true, reason: "dry-run" },
      dd: {
        agent,
        command,
        args: redactDdArgs(args, clipboardResult),
      },
    };
  }

  const exitCode = await spawnInherit(command, args, io);
  const cleanup = exitCode === 0 ? await cleanupArtifact(clipboardResult, options) : { kept: true };
  return { artifact: clipboardResult, cleanup, dd: { agent, exitCode } };
}

async function runCodex(options, system, io) {
  return runDd({ ...options, agent: "codex" }, system, io);
}

function redactDdArgs(args, clipboardResult) {
  return args.map((arg) => {
    let redacted = String(arg);
    const replacements = [
      [clipboardResult.imagePath, "capture.png"],
      [clipboardResult.textPath, "clipboard.txt"],
      [clipboardResult.artifactDir, "<lazycopy-artifact-dir>"],
    ].filter(([value]) => typeof value === "string" && value.length > 0);

    for (const [value, replacement] of replacements) {
      redacted = redacted.split(value).join(replacement);
    }

    if (clipboardResult.kind === "text" && redacted.includes("LazyCopy clipboard text")) {
      return "<prompt-with-clipboard-text:redacted>";
    }
    if (clipboardResult.kind === "image" && redacted.includes("LazyCopy clipboard image")) {
      return "<prompt-with-clipboard-image:redacted>";
    }
    return redacted;
  });
}

function redactCodexArgs(args, kind) {
  return redactDdArgs(args, { kind });
}

async function runDesktop(options, system) {
  if (
    system.platform === "win32" &&
    options.paste !== false &&
    !options.fixtureImage &&
    typeof system.captureCopyPaste === "function"
  ) {
    const tempImage = system.tempPngPath("lazycopy-window");
    try {
      const pastedTo = options.appName ?? "Codex";
      const capture = await system.captureCopyPaste(tempImage, {
        appName: pastedTo,
        mode: options.mode,
        platform: system.platform,
      });
      const result = await createCaptureArtifact({
        sourceImage: tempImage,
        mode: options.mode,
        outputRoot: options.outputRoot,
        platform: system.platform,
        source: capture.source,
      });
      return {
        ...result,
        cleanup: await cleanupArtifact(result, options),
        copiedToClipboard: true,
        pastedTo,
      };
    } finally {
      await removeIfExists(tempImage);
    }
  }

  const result = await runCapture(options, system);
  await system.copyImageToClipboard(result.imagePath, { platform: system.platform });

  let pastedTo = null;
  if (options.paste !== false) {
    pastedTo = options.appName ?? "Codex";
    await system.pasteIntoApp(pastedTo, { platform: system.platform });
  }

  return {
    ...result,
    cleanup: await cleanupArtifact(result, options),
    copiedToClipboard: true,
    pastedTo,
  };
}

function hotkeyCommand(system, options) {
  const appName = options.appName ?? "Codex";
  return [
    process.execPath,
    path.join(system.repoRoot(), "bin", "lazycopy.js"),
    "appshot",
    "desktop",
    "--mode",
    "active-window",
    "--paste-to",
    appName,
  ];
}

function hotkeyListenerCommand(system, options) {
  const command = [
    process.execPath,
    path.join(system.repoRoot(), "bin", "lazycopy.js"),
    "appshot",
    "hotkey",
    "run",
    "--key",
    options.key,
    "--app",
    options.appName ?? "Codex",
  ];
  if (options.logPath) {
    command.push("--log-path", options.logPath);
  }
  return command;
}

function windowsHotkeyRunArgs(system, options) {
  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-STA",
    "-File",
    path.join(system.repoRoot(), "scripts", "windows-hotkey.ps1"),
    "-Key",
    options.key,
  ];
  if (options.logPath) {
    args.push("-LogPath", options.logPath);
  }
  args.push(...hotkeyCommand(system, options));
  return args;
}

function windowsWatcherRunArgs(system, options) {
  const listenerCommand = [powershellCommand(system), ...windowsHotkeyRunArgs(system, options)];
  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-STA",
    "-File",
    path.join(system.repoRoot(), "scripts", "windows-appshot-watch.ps1"),
    "-Key",
    options.key,
    "-AppName",
    options.appName ?? "Codex",
  ];
  if (options.logPath) {
    args.push("-LogPath", options.logPath);
  }
  args.push("-PollSeconds", "2", ...listenerCommand);
  return args;
}

function powershellCommand(system) {
  if (typeof system.powershellBin === "function") {
    return system.powershellBin();
  }
  return system.powershellBin || "powershell.exe";
}

function launchAgentPlist(system, options) {
  const key = options.key;
  const args = [
    process.execPath,
    path.join(system.repoRoot(), "bin", "lazycopy.js"),
    "appshot",
    "hotkey",
    "run",
    "--key",
    key,
    "--app",
    options.appName ?? "Codex",
  ];
  const argXml = args.map((arg) => `    <string>${escapeXml(arg)}</string>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.lazycopy.hotkey</string>
  <key>ProgramArguments</key>
  <array>
${argXml}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
`;
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function runHotkey(options, system, io, action) {
  const key = options.key ?? DEFAULT_HOTKEY;
  const logPath = options.logPath ?? system.hotkeyLogPath?.();
  const hotkeyOptions = { ...options, key, logPath };

  if (action === "run") {
    if (system.platform === "win32") {
      return spawnInherit(
        powershellCommand(system),
        windowsHotkeyRunArgs(system, hotkeyOptions),
        io,
      );
    }
    const args = [
      path.join(system.repoRoot(), "scripts", "hotkey.swift"),
      hotkeyOptions.key,
      "--",
      ...hotkeyCommand(system, hotkeyOptions),
    ];
    return spawnInherit(system.swiftBin, args, io);
  }

  if (action === "install") {
    if (system.platform === "win32") {
      const powershell = powershellCommand(system);
      const command = [powershell, ...windowsWatcherRunArgs(system, hotkeyOptions)];
      const startupCommand = hiddenHotkeyStartupCommand(command, {
        powershell,
      });
      if (options.dryRun) {
        return {
          startupPath: system.startupShortcutPath?.(),
          command,
          startupCommand,
          logPath: hotkeyOptions.logPath,
          key: hotkeyOptions.key,
          appName: hotkeyOptions.appName ?? "Codex",
          mode: "watcher",
        };
      }
      const installed = await system.installHotkey(command, {
        platform: system.platform,
        logPath: hotkeyOptions.logPath,
        startupCommand,
      });
      return {
        ...installed,
        command,
        key: hotkeyOptions.key,
        appName: hotkeyOptions.appName ?? "Codex",
        mode: "watcher",
      };
    }
    const plist = launchAgentPlist(system, hotkeyOptions);
    const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", "com.lazycopy.hotkey.plist");
    if (options.dryRun) {
      return { plistPath, plist };
    }
    await fs.mkdir(path.dirname(plistPath), { recursive: true });
    await fs.writeFile(plistPath, plist);
    await spawnInherit("/bin/launchctl", ["bootstrap", `gui/${process.getuid()}`, plistPath], io);
    return { plistPath };
  }

  if (action === "uninstall") {
    if (system.platform === "win32") {
      return system.uninstallHotkey({ platform: system.platform });
    }
    const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", "com.lazycopy.hotkey.plist");
    await spawnInherit("/bin/launchctl", ["bootout", `gui/${process.getuid()}`, plistPath], io);
    await fs.rm(plistPath, { force: true });
    return { plistPath };
  }

  throw new LazyCopyError("UNKNOWN_HOTKEY_ACTION", `Unknown hotkey action ${action}.`);
}

function spawnInherit(command, args, io) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: io.inheritStdio === false ? "pipe" : "inherit",
    });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

function defaultSystem() {
  return {
    ...platformSystem,
    claudeBin: process.env.LAZYCOPY_CLAUDE_BIN || "claude",
    codexBin: process.env.LAZYCOPY_CODEX_BIN || "codex",
    platform: process.platform,
    powershellBin: process.env.LAZYCOPY_POWERSHELL_BIN || "powershell.exe",
    swiftBin: "swift",
  };
}

async function runCli(argv, io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const system = io.system ?? defaultSystem();
  const wantsJson = argv.includes("--json") || argv.includes("--dry-run");

  try {
    const parsed = parseArgs(argv);
    if (parsed.command === "help" || parsed.options?.help) {
      stdout.write(usage);
      return 0;
    }

    let result;
    if (parsed.command === "appshot-capture" || parsed.command === "capture") {
      result = await runCapture(parsed.options, system);
    } else if (parsed.command === "clipboard") {
      result = await runClipboard(parsed.options, system);
    } else if (parsed.command === "dd") {
      result = await runDd(parsed.options, system, io);
    } else if (parsed.command === "codex") {
      result = await runCodex(parsed.options, system, io);
    } else if (parsed.command === "appshot-desktop" || parsed.command === "desktop") {
      result = await runDesktop(parsed.options, system);
    } else if (parsed.command === "appshot-hotkey") {
      result = await runHotkey(parsed.options, system, io, parsed.action);
    }

    if (wantsJson) {
      writeJson(stdout, { ok: true, ...result });
    } else if (result?.artifactDir) {
      stdout.write(`Created LazyCopy artifact: ${result.artifactDir}\n`);
    }
    return typeof result === "number" ? result : 0;
  } catch (error) {
    const normalized = normalizeError(error);
    if (wantsJson) {
      writeJson(stdout, {
        ok: false,
        error: {
          code: normalized.code,
          message: normalized.message,
        },
      });
    } else {
      stderr.write(`lazycopy: ${normalized.message}\n`);
    }
    return 1;
  }
}

module.exports = {
  buildCodexArgs,
  buildClaudeArgs,
  buildDdArgs,
  DEFAULT_HOTKEY,
  launchAgentPlist,
  parseArgs,
  redactDdArgs,
  redactCodexArgs,
  runCli,
  usage,
};
