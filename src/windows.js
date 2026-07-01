const { execFile, spawn } = require("node:child_process");
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

function powershellBin() {
  return process.env.LAZYCOPY_POWERSHELL_BIN || "powershell.exe";
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

function runPowerShell(scriptName, args, options = {}) {
  return runFile(
    options.powershell ?? powershellBin(),
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-STA", "-File", scriptPath(scriptName), ...args],
    { encoding: "utf8", maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024 },
  );
}

function requireWindows(platform = process.platform) {
  if (platform !== "win32") {
    throw new LazyCopyError("WINDOWS_REQUIRED", "This command targets Windows desktop automation.");
  }
}

async function ensureParent(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function captureScreenToFile(targetPath, options = {}) {
  requireWindows(options.platform);
  await ensureParent(targetPath);
  const mode = options.mode ?? "active-window";
  const result = await runPowerShell(
    "windows-capture.ps1",
    ["-TargetPath", targetPath, "-Mode", mode],
    options,
  );
  let source = { type: `windows-${mode}`, nativeCapture: true };
  try {
    source = JSON.parse(result.stdout.trim());
  } catch {
  }
  return { source };
}

async function copyImageToClipboard(imagePath, options = {}) {
  requireWindows(options.platform);
  await runPowerShell("windows-copy-image-to-clipboard.ps1", ["-ImagePath", imagePath], options);
}

async function readClipboardImageToFile(targetPath, options = {}) {
  requireWindows(options.platform);
  await ensureParent(targetPath);
  await runPowerShell("windows-read-clipboard-image.ps1", ["-TargetPath", targetPath], options);
}

async function readClipboardText(options = {}) {
  requireWindows(options.platform);
  const result = await runPowerShell("windows-read-clipboard-text.ps1", [], options);
  return result.stdout.replace(/\r?\n$/, "");
}

async function pasteIntoApp(appName = "Codex", options = {}) {
  requireWindows(options.platform);
  await runPowerShell("windows-paste-into-app.ps1", ["-AppName", appName], options);
}

function tempPngPath(prefix = "lazycopy") {
  return path.join(os.tmpdir(), `${prefix}-${process.pid}-${Date.now()}.png`);
}

function startupShortcutPath() {
  const appData = process.env.APPDATA;
  if (!appData) {
    throw new LazyCopyError("APPDATA_UNAVAILABLE", "APPDATA is required to install the Windows hotkey.");
  }
  return path.join(
    appData,
    "Microsoft",
    "Windows",
    "Start Menu",
    "Programs",
    "Startup",
    "LazyCopy-AppShot-Hotkey.cmd",
  );
}

function quoteCmdArg(arg) {
  return `"${String(arg).replace(/"/g, '""')}"`;
}

async function installHotkey(command, options = {}) {
  requireWindows(options.platform);
  const startupPath = startupShortcutPath();
  await ensureParent(startupPath);
  const commandLine = command.map(quoteCmdArg).join(" ");
  await fs.writeFile(
    startupPath,
    `@echo off\r\nstart "LazyCopy AppShot Hotkey" /min ${commandLine}\r\n`,
  );

  const child = spawn(command[0], command.slice(1), {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  return { startupPath, started: true };
}

async function uninstallHotkey(options = {}) {
  requireWindows(options.platform);
  const startupPath = startupShortcutPath();
  await fs.rm(startupPath, { force: true });
  return { startupPath };
}

module.exports = {
  captureScreenToFile,
  copyImageToClipboard,
  installHotkey,
  pasteIntoApp,
  powershellBin,
  readClipboardImageToFile,
  readClipboardText,
  repoRoot,
  runFile,
  startupShortcutPath,
  tempPngPath,
  uninstallHotkey,
};
