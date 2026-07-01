#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const codexRoot = path.join(os.homedir(), ".codex");
const claudeRoot = path.join(os.homedir(), ".claude");
const skillsDir = path.join(codexRoot, "skills");
const promptsDir = path.join(codexRoot, "prompts");
const claudeCommandsDir = path.join(claudeRoot, "commands");
const ddSkillDir = path.join(skillsDir, "dd");
const shorthandSkillDir = path.join(skillsDir, "ㅇㅇ");
const promptSource = path.join(repoRoot, "prompts", "dd.md");
const shorthandPromptSource = path.join(repoRoot, "prompts", "ㅇㅇ.md");
const promptTarget = path.join(promptsDir, "dd.md");
const shorthandPromptTarget = path.join(promptsDir, "ㅇㅇ.md");
const claudeCommandSource = path.join(repoRoot, "commands", "dd.md");
const claudeShorthandCommandSource = path.join(repoRoot, "commands", "ㅇㅇ.md");
const claudeCommandTarget = path.join(claudeCommandsDir, "dd.md");
const claudeShorthandCommandTarget = path.join(claudeCommandsDir, "ㅇㅇ.md");
const ddSkillSource = path.join(repoRoot, "SKILL.md");
const ddSkillTarget = path.join(ddSkillDir, "SKILL.md");
const shorthandSkillSource = path.join(repoRoot, "skills", "ㅇㅇ", "SKILL.md");
const shorthandSkillTarget = path.join(shorthandSkillDir, "SKILL.md");

function installPlatform() {
  return process.env.LAZYCOPY_INSTALL_TEST_PLATFORM || process.platform;
}

function isWindows() {
  return installPlatform() === "win32";
}

function resolveRunCommand(command, platform = installPlatform()) {
  if (platform === "win32" && command === "npm") {
    return "npm.cmd";
  }
  return command;
}

function run(command, args, options = {}) {
  const platform = options.platform ?? installPlatform();
  const result = spawnSync(resolveRunCommand(command, platform), args, {
    cwd: options.cwd ?? repoRoot,
    stdio: "inherit",
    shell: false,
    windowsHide: platform === "win32",
  });
  if (result.error || result.status !== 0) {
    const status = result.status ?? 1;
    if (options.optional) {
      const detail = result.error ? `${result.error.code || "ERROR"} ${result.error.message}` : `exit ${status}`;
      console.warn(`Warning: ${command} ${args.join(" ")} failed (${detail}); continuing.`);
      return { ok: false, status, error: result.error };
    }
    process.exit(status);
  }
  return { ok: true, status: 0 };
}

function runNpmLink(options = {}) {
  return run("npm", ["link"], options);
}

function sameExistingPath(left, right) {
  try {
    return fs.realpathSync.native(left) === fs.realpathSync.native(right);
  } catch {
    return false;
  }
}

function copySkillFile(source, target) {
  if (!sameExistingPath(source, target)) {
    fs.copyFileSync(source, target);
  }
}

function ensureDdSkill() {
  fs.mkdirSync(skillsDir, { recursive: true });
  if (!fs.existsSync(ddSkillDir)) {
    fs.symlinkSync(repoRoot, ddSkillDir, isWindows() ? "junction" : "dir");
    return;
  }
  if (sameExistingPath(ddSkillDir, repoRoot)) {
    copySkillFile(ddSkillSource, ddSkillTarget);
    return;
  }
  const stat = fs.lstatSync(ddSkillDir);
  if (!stat.isDirectory() && !stat.isSymbolicLink()) {
    throw new Error(`${ddSkillDir} exists but is not a skill directory.`);
  }
  fs.mkdirSync(ddSkillDir, { recursive: true });
  copySkillFile(ddSkillSource, ddSkillTarget);
}

function installShorthandSkill() {
  if (fs.existsSync(shorthandSkillDir)) {
    const stat = fs.lstatSync(shorthandSkillDir);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      fs.rmSync(shorthandSkillDir, { force: true, recursive: true });
    }
  }
  fs.mkdirSync(shorthandSkillDir, { recursive: true });
  fs.copyFileSync(shorthandSkillSource, shorthandSkillTarget);
}

function installPrompt() {
  fs.mkdirSync(promptsDir, { recursive: true });
  fs.copyFileSync(promptSource, promptTarget);
  fs.copyFileSync(shorthandPromptSource, shorthandPromptTarget);
}

function installClaudeCommands() {
  fs.mkdirSync(claudeCommandsDir, { recursive: true });
  fs.copyFileSync(claudeCommandSource, claudeCommandTarget);
  fs.copyFileSync(claudeShorthandCommandSource, claudeShorthandCommandTarget);
}

function windowsUserBinDir() {
  return path.join(os.homedir(), "bin");
}

function windowsUserBinIsAheadOfGit(binDir) {
  const pathValue = process.env.Path || process.env.PATH || "";
  const separator = isWindows() ? ";" : path.delimiter;
  const parts = pathValue
    .split(separator)
    .map((part) => path.normalize(part).toLowerCase());
  const binIndex = parts.indexOf(path.normalize(binDir).toLowerCase());
  const gitIndex = parts.findIndex((part) => part.endsWith(path.normalize("git\\usr\\bin").toLowerCase()));
  return binIndex !== -1 && (gitIndex === -1 || binIndex < gitIndex);
}

function writeExecutable(filePath, content) {
  fs.writeFileSync(filePath, content);
  fs.chmodSync(filePath, 0o755);
}

function installWindowsUserBinWrappers() {
  const binDir = windowsUserBinDir();
  fs.mkdirSync(binDir, { recursive: true });

  const lazycopyEntry = "%USERPROFILE%\\.codex\\skills\\dd\\bin\\lazycopy.js";
  const shEntry = "$USERPROFILE/.codex/skills/dd/bin/lazycopy.js";
  const wrappers = {
    "dd.cmd": `@echo off\r\nnode "${lazycopyEntry}" dd %*\r\n`,
    "ㅇㅇ.cmd": `@echo off\r\nnode "${lazycopyEntry}" dd %*\r\n`,
    "lazycopy.cmd": `@echo off\r\nnode "${lazycopyEntry}" %*\r\n`,
    dd: `#!/usr/bin/env sh\nexec node "${shEntry}" dd "$@"\n`,
    "ㅇㅇ": `#!/usr/bin/env sh\nexec node "${shEntry}" dd "$@"\n`,
    lazycopy: `#!/usr/bin/env sh\nexec node "${shEntry}" "$@"\n`,
  };

  for (const [name, content] of Object.entries(wrappers)) {
    writeExecutable(path.join(binDir, name), content);
  }

  console.log(`Windows user-bin wrappers installed at ${binDir}.`);
  if (!windowsUserBinIsAheadOfGit(binDir)) {
    console.warn(`Warning: ${binDir} is not before Git usr\\bin on PATH; Git Bash may still resolve coreutils dd first.`);
  }
}

ensureDdSkill();
installShorthandSkill();
installPrompt();
installClaudeCommands();

if (isWindows()) {
  installWindowsUserBinWrappers();
  if (process.env.LAZYCOPY_INSTALL_SKIP_HOTKEY !== "1") {
    const hotkeyInstallArgs = [
      path.join(repoRoot, "bin", "lazycopy.js"),
      "appshot",
      "hotkey",
      "install",
      "--key",
      "shift+space",
      "--app",
      "Codex",
    ];
    if (process.env.LAZYCOPY_INSTALL_SKIP_HOTKEY_START === "1") {
      hotkeyInstallArgs.push("--no-start");
    }
    run(process.execPath, hotkeyInstallArgs);
  }
  if (process.env.LAZYCOPY_INSTALL_SKIP_NPM_LINK !== "1") {
    runNpmLink({ optional: true });
  }
  console.log("LazyCopy installed as /dd, $dd, /ㅇㅇ, $ㅇㅇ, dd, ㅇㅇ, Claude Code /dd, Claude Code /ㅇㅇ, and watcher-managed Shift+Space AppShot.");
} else {
  if (process.env.LAZYCOPY_INSTALL_SKIP_NPM_LINK !== "1") {
    runNpmLink();
  }
  console.log("LazyCopy installed as /dd, $dd, /ㅇㅇ, $ㅇㅇ, dd, ㅇㅇ, Claude Code /dd, and Claude Code /ㅇㅇ. Shift+Space AppShot auto-install is Windows-only.");
}
