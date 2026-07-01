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
const macos = require("./macos");

const usage = `Usage:
  lazycopy capture --json [--fixture-image <png>] [--output-root <dir>] [--mode active-window|region|fullscreen]
  lazycopy clipboard --json [--output-root <dir>] [--prefer image|text]
  lazycopy codex --resume last [--prompt <text>] [--dry-run] [--output-root <dir>]
  lazycopy desktop [--mode active-window|region|fullscreen] [--paste-to Codex] [--json]
  lazycopy hotkey run --key command+shift+l [--app Codex]
  lazycopy hotkey install --key command+shift+l [--app Codex] [--dry-run]

Commands:
  capture    Create a capture artifact from a PNG fixture or macOS screen capture.
  clipboard  Package the latest clipboard image or text for an AI agent.
  codex      Resume Codex CLI with the latest clipboard attached or included.
  desktop    Capture the current window, copy it, and paste it into Codex Desktop.
  hotkey     Run or install a macOS global shortcut for the desktop command.

Options:
  --json                 Print machine-readable JSON.
  --fixture-image <png>  PNG file to copy into the artifact.
  --output-root <dir>    Directory where artifacts are written. Defaults to ${DEFAULT_OUTPUT_ROOT}.
  --mode <mode>          active-window, region, or fullscreen.
  --prefer <kind>        image or text for clipboard reads.
  --resume last          Resume the latest Codex CLI session.
  --prompt <text>        Prompt sent with clipboard content.
  --dry-run              Print what would run without launching Codex or installing.
  --paste-to <app>       App name to activate and paste into. Defaults to Codex.
  --no-paste             Capture and copy only; do not activate an app.
  --key <shortcut>       Hotkey such as command+shift+l or control+option+c.
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
  if (command === "hotkey") {
    const action = argv[1];
    if (!action || action.startsWith("--")) {
      throw new LazyCopyError("MISSING_HOTKEY_ACTION", "Expected hotkey run or hotkey install.");
    }
    return {
      command: "hotkey",
      action,
      options: parseFlagArgs(argv.slice(2), { appName: "Codex" }),
    };
  }

  if (!["capture", "clipboard", "codex", "desktop"].includes(command)) {
    throw new LazyCopyError("UNKNOWN_COMMAND", `Unknown command ${command}.`);
  }

  const defaults = {
    capture: { json: false, mode: "active-window" },
    clipboard: { json: false, prefer: "auto" },
    codex: { json: false, resume: "last" },
    desktop: { appName: "Codex", json: false, mode: "active-window", paste: true },
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

async function runCodex(options, system, io) {
  if (options.resume !== "last") {
    throw new LazyCopyError("UNSUPPORTED_RESUME", "Only --resume last is supported.");
  }

  const clipboardResult = await runClipboard(
    { outputRoot: options.outputRoot, prefer: options.prefer ?? "auto" },
    system,
  );

  const promptClipboard =
    clipboardResult.kind === "text"
      ? await fs.readFile(clipboardResult.textPath, "utf8")
      : undefined;

  const codexArgs = buildCodexArgs(
    { ...clipboardResult, text: promptClipboard },
    options.prompt,
  );
  if (options.dryRun) {
    return {
      artifact: clipboardResult,
      codex: {
        command: system.codexBin,
        args: redactCodexArgs(codexArgs, clipboardResult.kind),
      },
    };
  }

  const exitCode = await spawnInherit(system.codexBin, codexArgs, io);
  return { artifact: clipboardResult, codex: { exitCode } };
}

function redactCodexArgs(args, kind) {
  if (kind !== "text") {
    return args;
  }
  return args.map((arg, index) => (index === args.length - 1 ? "<prompt-with-clipboard-text:redacted>" : arg));
}

async function runDesktop(options, system) {
  const result = await runCapture(options, system);
  await system.copyImageToClipboard(result.imagePath, { platform: system.platform });

  let pastedTo = null;
  if (options.paste !== false) {
    pastedTo = options.appName ?? "Codex";
    await system.pasteIntoApp(pastedTo, { platform: system.platform });
  }

  return {
    ...result,
    copiedToClipboard: true,
    pastedTo,
  };
}

function hotkeyCommand(system, options) {
  const appName = options.appName ?? "Codex";
  return [
    process.execPath,
    path.join(system.repoRoot(), "bin", "lazycopy.js"),
    "desktop",
    "--mode",
    "active-window",
    "--paste-to",
    appName,
  ];
}

function launchAgentPlist(system, options) {
  const key = options.key;
  const args = [
    process.execPath,
    path.join(system.repoRoot(), "bin", "lazycopy.js"),
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
  if (!options.key) {
    throw new LazyCopyError("MISSING_HOTKEY", "Missing --key.");
  }

  if (action === "run") {
    const args = [
      path.join(system.repoRoot(), "scripts", "hotkey.swift"),
      options.key,
      "--",
      ...hotkeyCommand(system, options),
    ];
    return spawnInherit(system.swiftBin, args, io);
  }

  if (action === "install") {
    const plist = launchAgentPlist(system, options);
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
    ...macos,
    codexBin: process.env.LAZYCOPY_CODEX_BIN || "codex",
    platform: process.platform,
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
    if (parsed.command === "capture") {
      result = await runCapture(parsed.options, system);
    } else if (parsed.command === "clipboard") {
      result = await runClipboard(parsed.options, system);
    } else if (parsed.command === "codex") {
      result = await runCodex(parsed.options, system, io);
    } else if (parsed.command === "desktop") {
      result = await runDesktop(parsed.options, system);
    } else if (parsed.command === "hotkey") {
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
  launchAgentPlist,
  parseArgs,
  redactCodexArgs,
  runCli,
  usage,
};
