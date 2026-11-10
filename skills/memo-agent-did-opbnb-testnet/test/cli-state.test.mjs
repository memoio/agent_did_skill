import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

test("an unrelated populated state directory is rejected before adding identity files", () => {
  const root = mkdtempSync(resolve(tmpdir(), "memo-opbnb-state-"));
  const marker = resolve(root, "unrelated-state");
  try {
    writeFileSync(marker, "keep");
    const result = spawnSync(process.execPath, [resolve("bin/memo-agent-opbnb-testnet"), "identity", "status"], {
      cwd: resolve(import.meta.dirname, ".."),
      env: { ...process.env, MEMO_AGENT_OPBNB_HOME: root },
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /STATE_NAMESPACE_CONFLICT/);
    assert.equal(readFileSync(marker, "utf8"), "keep");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
