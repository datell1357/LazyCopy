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

function ensureSkillAlias(targetDir) {
  fs.mkdirSync(skillsDir, { recursive: true });
  if (fs.existsSync(targetDir)) {
    return;
  }
  fs.symlinkSync(repoRoot, targetDir, process.platform === "win32" ? "junction" : "dir");
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

ensureSkillAlias(ddSkillDir);
ensureSkillAlias(shorthandSkillDir);
installPrompt();
installClaudeCommands();
run("npm", ["link"]);

if (process.platform === "win32") {
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
  console.log("LazyCopy installed as /dd, $dd, /ㅇㅇ, $ㅇㅇ, dd, ㅇㅇ, Claude Code /dd, Claude Code /ㅇㅇ, and Shift+Space AppShot.");
} else {
  console.log("LazyCopy installed as /dd, $dd, /ㅇㅇ, $ㅇㅇ, dd, ㅇㅇ, Claude Code /dd, and Claude Code /ㅇㅇ. Shift+Space AppShot auto-install is Windows-only.");
}
