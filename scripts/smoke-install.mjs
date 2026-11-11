#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const bundle = resolve(fileURLToPath(new URL("..", import.meta.url)));
const temporary = mkdtempSync(resolve(tmpdir(), "memo-opbnb-install-"));
const destination = resolve(temporary, "installed-skill");
function run(args) {
  const result = spawnSync(process.execPath, [resolve(bundle, "scripts/install.mjs"), ...args, "--json"], { encoding: "utf8", timeout: 180_000, env: { ...process.env, HOME: resolve(temporary, "home") } });
  assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
  return JSON.parse(result.stdout);
}
try {
  const preview = run(["--target", "runtime", "--dest", destination, "--dry-run"]);
  assert.equal(preview.installed, false);
  assert.equal(existsSync(destination), false);
  const first = run(["--target", "runtime", "--dest", destination]);
  assert.equal(first.installed, true);
  assert.equal(first.generatedIdentity, false);
  assert.equal(existsSync(resolve(destination, "node_modules/ethers")), true);
  assert.match(readFileSync(resolve(destination, "SKILL.md"), "utf8"), /chain-5611/);
  writeFileSync(resolve(destination, "old-marker"), "original");
  const staleBackup = `${destination}.backup-previous`;
  mkdirSync(staleBackup);
  writeFileSync(resolve(staleBackup, "SKILL.md"), "---\nname: memo-agent-did-opbnb-testnet\n---\n");
  const upgraded = run(["--target", "runtime", "--dest", destination, "--upgrade"]);
  assert.equal(readFileSync(resolve(upgraded.backupPath, "old-marker"), "utf8"), "original");
  assert.equal(upgraded.backupPath.startsWith(resolve(temporary, "home")), true);
  assert.equal(existsSync(staleBackup), false);
  assert.ok(readdirSync(resolve(temporary, "home/.memo-agent-opbnb-install-backups")).some(name => name.startsWith("installed-skill.backup-previous-")));
  assert.equal(existsSync(resolve(destination, "old-marker")), false);
  process.stdout.write(JSON.stringify({ passed: true, installed: true, upgradeBackup: true, generatedIdentity: false }) + "\n");
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
