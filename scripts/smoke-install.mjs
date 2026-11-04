#!/usr/bin/env node
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const bundle = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporary = mkdtempSync(resolve(tmpdir(), "memo-skill-smoke-"));
const state = resolve(temporary, "agent-state");
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("MEMO_AGENT_MAINNET_")));
Object.assign(env, {
  MEMO_AGENT_MAINNET_HOME: state,
  MEMO_AGENT_MAINNET_INSTALLATION_ID: "installation-smoke",
  MEMO_AGENT_MAINNET_ENVIRONMENT: "local",
  MEMO_AGENT_MAINNET_API_URL: "http://127.0.0.1:1",
  MEMO_AGENT_MAINNET_KEY_PROVIDER: "env-master-key",
});

function run(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: temporary, env, encoding: "utf8", timeout: 120_000 });
  assert.equal(result.status, 0, `${basename(script)} failed: ${result.stdout || result.stderr || result.error?.message}`);
  return JSON.parse(result.stdout);
}

try {
  const standalone = resolve(temporary, "standalone Skill");
  cpSync(resolve(bundle, "skills/memo-agent-did-mainnet"), standalone, {
    recursive: true,
    filter: (path) => !["node_modules", ".data", ".DS_Store"].includes(basename(path)),
  });
  assert.equal(existsSync(resolve(standalone, "node_modules")), false);
  const linked = resolve(temporary, "linked-skill");
  symlinkSync(standalone, linked, process.platform === "win32" ? "junction" : "dir");
  for (const root of [standalone, linked]) {
    const setup = run(resolve(root, "scripts/setup-runtime.mjs"), ["--json"]);
    assert.equal(setup.ready, true);
    assert.equal(setup.readyScope, "runtime-dependencies");
    assert.equal(setup.generatedIdentity, false);
    assert.equal(existsSync(state), false);
  }
  const destination = resolve(temporary, "installed Skill");
  const installed = run(resolve(bundle, "scripts/install.mjs"), ["--target", "runtime", "--dest", destination, "--json"]);
  assert.equal(installed.installed, true);
  assert.equal(installed.runtimeDependenciesReady, true);
  assert.equal(installed.identityStorageChecked, false);
  assert.equal(installed.next.length, 1);
  assert.match(installed.next[0], /doctor --json$/);
  assert.equal(installed.generatedIdentity, false);
  assert.equal(existsSync(state), false);
  writeFileSync(resolve(destination, "previous-release-marker"), "previous");
  const upgraded = run(resolve(bundle, "scripts/install.mjs"), ["--target", "runtime", "--dest", destination, "--upgrade", "--json"]);
  assert.equal(readFileSync(resolve(upgraded.backupPath, "previous-release-marker"), "utf8"), "previous");
  assert.equal(existsSync(resolve(destination, "previous-release-marker")), false);
  assert.equal(existsSync(state), false);
  const doctor = run(resolve(destination, "bin/memo-agent-mainnet"), ["doctor", "--json"]);
  assert.equal(doctor.ok, true);
  assert.equal(doctor.data.ready, false);
  assert.equal(doctor.data.identityStorageReady, false);
  assert.deepEqual(doctor.data.blockingChecks, ["secureStorageReady"]);
  assert.equal(doctor.data.platformConnectivityChecked, false);
  const status = run(resolve(destination, "bin/memo-agent-mainnet"), ["identity", "status", "--json"]);
  assert.equal(status.ok, true);
  assert.equal(status.data.exists, false);
  assert.equal(existsSync(resolve(state, "agents/installation-smoke/keys.enc.json")), false);
  process.stdout.write(JSON.stringify({ passed: true, standalone: true, symlink: true, repeatedSetup: true, upgradeBackup: true, cli: true, storageBlockerReported: true, generatedIdentity: false }) + "\n");
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
