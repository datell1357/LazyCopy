#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const codexRoot = path.join(os.homedir(), ".codex");
const skillsDir = path.join(codexRoot, "skills");
const promptsDir = path.join(codexRoot, "prompts");
const ddSkillDir = path.join(skillsDir, "dd");
const promptSource = path.join(repoRoot, "prompts", "dd.md");
const promptTarget = path.join(promptsDir, "dd.md");

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

function ensureSkillAlias() {
  fs.mkdirSync(skillsDir, { recursive: true });
  if (fs.existsSync(ddSkillDir)) {
    return;
  }
  fs.symlinkSync(repoRoot, ddSkillDir, process.platform === "win32" ? "junction" : "dir");
}

function installPrompt() {
  fs.mkdirSync(promptsDir, { recursive: true });
  fs.copyFileSync(promptSource, promptTarget);
}

ensureSkillAlias();
installPrompt();
run("npm", ["link"]);

if (process.platform === "win32") {
  run(process.execPath, [
    path.join(repoRoot, "bin", "lazycopy.js"),
    "appshot",
    "hotkey",
    "install",
    "--key",
    "control+space",
    "--app",
    "Codex",
  ]);
  console.log("LazyCopy installed as $dd, /dd, and Ctrl+Space AppShot.");
} else {
  console.log("LazyCopy installed as $dd and /dd. Ctrl+Space AppShot auto-install is Windows-only.");
}
