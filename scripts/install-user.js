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
const installEntries = [
  "assets",
  "bin",
  "commands",
  "docs",
  "prompts",
  "scripts",
  "skills",
  "src",
  "LICENSE",
  "package.json",
  "README.md",
  "SKILL.md",
  "THIRD_PARTY_NOTICES.md",
];

function installPlatform() {
  return process.env.LAZYCOPY_INSTALL_TEST_PLATFORM || process.platform;
}

function isWindows() {
  return installPlatform() === "win32";
}

function resolveRunInvocation(command, args, platform = installPlatform()) {
  if (platform === "win32" && command === "npm") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "npm.cmd", ...args],
    };
  }
  return { command, args };
}

function run(command, args, options = {}) {
  const platform = options.platform ?? installPlatform();
  const invocation = resolveRunInvocation(command, args, platform);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
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

function npmLinkEnv(baseEnv = process.env) {
  const env = { ...baseEnv };
  const blockedKeys = new Set(["npm_config_prefix", "npm_config_local_prefix", "npm_config_global", "npm_config_location", "prefix"]);
  for (const key of Object.keys(env)) {
    if (blockedKeys.has(key.toLowerCase())) {
      delete env[key];
    }
  }
  return env;
}

function runNpmLink(options = {}) {
  return run("npm", ["link", "--force", "--loglevel=error"], {
    ...options,
    env: npmLinkEnv(options.env),
  });
}

function sameExistingPath(left, right) {
  try {
    return fs.realpathSync.native(left) === fs.realpathSync.native(right);
  } catch {
    return false;
  }
}

function lstatIfPresent(targetPath) {
  try {
    return fs.lstatSync(targetPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function hasLazyCopyMarker(targetPath) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(targetPath, "package.json"), "utf8"));
    if (packageJson.name === "lazycopy") {
      return true;
    }
  } catch {
  }
  try {
    const skill = fs.readFileSync(path.join(targetPath, "SKILL.md"), "utf8");
    return skill.includes("LazyCopy") || skill.includes("name: dd");
  } catch {
    return false;
  }
}

function clearInstallEntries(targetRoot) {
  for (const entry of installEntries) {
    fs.rmSync(path.join(targetRoot, entry), { recursive: true, force: true });
  }
}

function copyInstallTree(sourceRoot, targetRoot, options = {}) {
  if (options.replaceRoot) {
    fs.rmSync(targetRoot, { recursive: true, force: true });
  }
  fs.mkdirSync(targetRoot, { recursive: true });
  if (!options.replaceRoot) {
    clearInstallEntries(targetRoot);
  }
  for (const entry of installEntries) {
    const source = path.join(sourceRoot, entry);
    if (!fs.existsSync(source)) {
      continue;
    }
    fs.cpSync(source, path.join(targetRoot, entry), {
      recursive: true,
      force: true,
    });
  }
}

function copySkillFile(source, target) {
  if (!sameExistingPath(source, target)) {
    fs.copyFileSync(source, target);
  }
}

function ensureDdSkill() {
  fs.mkdirSync(skillsDir, { recursive: true });
  if (sameExistingPath(ddSkillDir, repoRoot)) {
    copySkillFile(ddSkillSource, ddSkillTarget);
    return repoRoot;
  }
  const stat = lstatIfPresent(ddSkillDir);
  if (!stat) {
    copyInstallTree(repoRoot, ddSkillDir, { replaceRoot: true });
    return ddSkillDir;
  }
  if (!stat.isDirectory() && !stat.isSymbolicLink()) {
    throw new Error(`${ddSkillDir} exists but is not a skill directory.`);
  }
  if (!stat.isSymbolicLink() && fs.existsSync(ddSkillDir) && !hasLazyCopyMarker(ddSkillDir)) {
    throw new Error(`${ddSkillDir} exists but does not look like a LazyCopy skill directory.`);
  }
  copyInstallTree(repoRoot, ddSkillDir, { replaceRoot: stat.isSymbolicLink() });
  return ddSkillDir;
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

const runtimeRoot = ensureDdSkill();
installShorthandSkill();
installPrompt();
installClaudeCommands();

if (isWindows()) {
  installWindowsUserBinWrappers();
  if (process.env.LAZYCOPY_INSTALL_SKIP_HOTKEY !== "1") {
    const hotkeyInstallArgs = [
      path.join(runtimeRoot, "bin", "lazycopy.js"),
      "appshot",
      "hotkey",
      "install",
      "--key",
      "shift+space",
      "--app",
      "Codex",
      "--json",
    ];
    if (process.env.LAZYCOPY_INSTALL_SKIP_HOTKEY_START === "1") {
      hotkeyInstallArgs.push("--no-start");
    }
    run(process.execPath, hotkeyInstallArgs);
  }
  if (process.env.LAZYCOPY_INSTALL_SKIP_NPM_LINK !== "1") {
    runNpmLink({ optional: true, cwd: runtimeRoot });
  }
  console.log("LazyCopy installed as /dd, $dd, /ㅇㅇ, $ㅇㅇ, dd, ㅇㅇ, Claude Code /dd, Claude Code /ㅇㅇ, and watcher-managed Shift+Space AppShot.");
} else {
  if (process.env.LAZYCOPY_INSTALL_SKIP_NPM_LINK !== "1") {
    runNpmLink({ cwd: runtimeRoot });
  }
  console.log("LazyCopy installed as /dd, $dd, /ㅇㅇ, $ㅇㅇ, dd, ㅇㅇ, Claude Code /dd, and Claude Code /ㅇㅇ. Shift+Space AppShot auto-install is Windows-only.");
}
