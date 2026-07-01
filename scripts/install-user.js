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

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
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
    fs.symlinkSync(repoRoot, ddSkillDir, process.platform === "win32" ? "junction" : "dir");
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
  fs.copyFileSync(promptSource, shorthandPromptTarget);
}

function installClaudeCommands() {
  fs.mkdirSync(claudeCommandsDir, { recursive: true });
  fs.copyFileSync(claudeCommandSource, claudeCommandTarget);
  fs.copyFileSync(claudeShorthandCommandSource, claudeShorthandCommandTarget);
}

ensureDdSkill();
installShorthandSkill();
installPrompt();
installClaudeCommands();
if (process.env.LAZYCOPY_INSTALL_SKIP_NPM_LINK !== "1") {
  run("npm", ["link"]);
}

if (process.platform === "win32") {
  if (process.env.LAZYCOPY_INSTALL_SKIP_HOTKEY !== "1") {
    run(process.execPath, [
      path.join(repoRoot, "bin", "lazycopy.js"),
      "appshot",
      "hotkey",
      "install",
      "--key",
      "shift+space",
      "--app",
      "Codex",
    ]);
  }
  console.log("LazyCopy installed as /dd, $dd, /ㅇㅇ, $ㅇㅇ, dd, ㅇㅇ, Claude Code /dd, Claude Code /ㅇㅇ, and Shift+Space AppShot.");
} else {
  console.log("LazyCopy installed as /dd, $dd, /ㅇㅇ, $ㅇㅇ, dd, ㅇㅇ, Claude Code /dd, and Claude Code /ㅇㅇ. Shift+Space AppShot auto-install is Windows-only.");
}
