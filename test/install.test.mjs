import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const bundle = resolve(fileURLToPath(new URL("..", import.meta.url)));
function install(args, env = {}) {
  return spawnSync(process.execPath, [resolve(bundle, "scripts/install.mjs"), ...args, "--json"], { encoding: "utf8", env: { ...process.env, ...env } });
}

test("installer selects only the opBNB Skill for each target", () => {
  const temporary = mkdtempSync(resolve(tmpdir(), "memo-opbnb-install-test-"));
  try {
    const home = resolve(temporary, "home");
    const cases = [
      ["codex-user", resolve(home, ".agents/skills/memo-agent-did-opbnb-testnet")],
      ["claude-user", resolve(home, ".claude/skills/memo-agent-did-opbnb-testnet")],
      ["codex-project", resolve(temporary, ".agents/skills/memo-agent-did-opbnb-testnet")],
    ];
    for (const [target, expected] of cases) {
      const args = ["--target", target, "--dry-run"];
      if (target === "codex-project") args.push("--project", temporary);
      const result = install(args, { HOME: home, CODEX_HOME: "" });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).destination, expected);
      assert.equal(existsSync(expected), false);
    }
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("an existing installation cannot be overwritten without upgrade", () => {
  const temporary = mkdtempSync(resolve(tmpdir(), "memo-opbnb-existing-"));
  try {
    const destination = resolve(temporary, "skill");
    mkdirSync(destination);
    writeFileSync(resolve(destination, "marker"), "keep");
    const result = install(["--target", "runtime", "--dest", destination]);
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(resolve(destination, "marker"), "utf8"), "keep");
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("installer rejects a destination inside its source", () => {
  const source = resolve(bundle, "skills/memo-agent-did-opbnb-testnet");
  for (const destination of [source, resolve(source, "nested"), resolve(bundle, "skills")]) {
    const result = install(["--target", "runtime", "--dest", destination, "--dry-run"]);
    assert.notEqual(result.status, 0);
  }
});
