const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { LazyCopyError } = require("./errors");

function repoRoot() {
  return path.resolve(__dirname, "..");
}

function scriptPath(name) {
  return path.join(repoRoot(), "scripts", name);
}

function runFile(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function requireMac(platform = process.platform) {
  if (platform !== "darwin") {
    throw new LazyCopyError(
      "MACOS_REQUIRED",
      "This command uses macOS window, pasteboard, or app automation APIs.",
    );
  }
}

async function ensureParent(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function getFrontWindowId(options = {}) {
  requireMac(options.platform);
  const swift = options.swift ?? "swift";
  const result = await runFile(swift, [scriptPath("front-window-id.swift")], {
    encoding: "utf8",
  });
  const id = result.stdout.trim();
  if (!/^\d+$/.test(id)) {
    throw new LazyCopyError(
      "FRONT_WINDOW_UNAVAILABLE",
      "Could not determine the frontmost window id.",
    );
  }
  return id;
}

async function captureScreenToFile(targetPath, options = {}) {
  requireMac(options.platform);
  await ensureParent(targetPath);
  const screencapture = options.screencapture ?? "/usr/sbin/screencapture";
  const mode = options.mode ?? "active-window";

  if (mode === "active-window") {
    const windowId = options.windowId ?? (await getFrontWindowId(options));
    await runFile(screencapture, ["-x", "-l", windowId, targetPath]);
    return { source: { type: "macos-front-window", windowId, nativeCapture: true } };
  }

  if (mode === "fullscreen") {
    await runFile(screencapture, ["-x", targetPath]);
    return { source: { type: "macos-fullscreen", nativeCapture: true } };
  }

  if (mode === "region") {
    await runFile(screencapture, ["-x", "-i", "-s", targetPath]);
    return { source: { type: "macos-region", nativeCapture: true } };
  }

  throw new LazyCopyError("INVALID_MODE", `Invalid mode "${mode}".`);
}

async function copyImageToClipboard(imagePath, options = {}) {
  requireMac(options.platform);
  const swift = options.swift ?? "swift";
  await runFile(swift, [scriptPath("copy-image-to-clipboard.swift"), imagePath], {
    encoding: "utf8",
  });
}

async function readClipboardImageToFile(targetPath, options = {}) {
  requireMac(options.platform);
  await ensureParent(targetPath);
  const swift = options.swift ?? "swift";
  await runFile(swift, [scriptPath("read-clipboard-image.swift"), targetPath], {
    encoding: "utf8",
  });
}

async function readClipboardText(options = {}) {
  requireMac(options.platform);
  const pbpaste = options.pbpaste ?? "/usr/bin/pbpaste";
  const result = await runFile(pbpaste, [], {
    encoding: "utf8",
    maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
  });
  return result.stdout;
}

async function pasteIntoApp(appName = "Codex", options = {}) {
  requireMac(options.platform);
  const osascript = options.osascript ?? "/usr/bin/osascript";
  const script = `
tell application ${JSON.stringify(appName)} to activate
delay 0.2
tell application "System Events"
  keystroke "v" using command down
end tell
`;
  await runFile(osascript, ["-e", script], { encoding: "utf8" });
}

function tempPngPath(prefix = "lazycopy") {
  return path.join(os.tmpdir(), `${prefix}-${process.pid}-${Date.now()}.png`);
}

module.exports = {
  captureScreenToFile,
  copyImageToClipboard,
  getFrontWindowId,
  pasteIntoApp,
  readClipboardImageToFile,
  readClipboardText,
  repoRoot,
  runFile,
  tempPngPath,
};
