import { test, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { setupRuntime } from "../skills/memo-agent-did-mainnet/scripts/setup-runtime.mjs";

const bundle = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporary = realpathSync(mkdtempSync(resolve(tmpdir(), "memo-skill-install-test-")));
after(() => rmSync(temporary, { recursive: true, force: true }));

function fixture(name) {
  const root = resolve(temporary, name);
  for (const file of ["package.json", "package-lock.json", "dist/index.js", "dist/cli.js", "bin/memo-agent-mainnet"]) {
    const path = resolve(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "");
  }
  return root;
}

function install(args, environment = {}) {
  const env = { ...process.env, HOME: resolve(temporary, "user"), ...environment };
  if (!("CODEX_HOME" in environment)) delete env.CODEX_HOME;
  return spawnSync(process.execPath, [resolve(bundle, "scripts/install.mjs"), ...args, "--json"], {
    cwd: temporary, env, encoding: "utf8",
  });
}

test("standalone runtime initialization uses the lockfile, skips lifecycle hooks and only imports the runtime", () => {
  const root = fixture("runtime");
  const calls = [];
  const result = setupRuntime({ root, run: (command, args, options) => {
    calls.push({ command, args, options });
    return { status: 0 };
  } });
  assert.equal(result.ready, true);
  assert.equal(result.generatedIdentity, false);
  assert.deepEqual(calls[0].args, ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", "--legacy-peer-deps"]);
  assert.equal(calls[0].options.cwd, root);
  assert.equal(calls[1].command, process.execPath);
  assert.match(calls[1].args.at(-1), /^await import\(/);
  assert.equal(existsSync(resolve(root, "keys.enc.json")), false);
});

test("incomplete distribution stops before npm or runtime execution", () => {
  const root = fixture("incomplete");
  rmSync(resolve(root, "dist/cli.js"));
  assert.throws(() => setupRuntime({ root, run: () => assert.fail("must not execute") }), { code: "RUNTIME_PACKAGE_INCOMPLETE" });
});

test("dependency failures stop before importing the runtime and do not expose subprocess output", () => {
  let calls = 0;
  assert.throws(() => setupRuntime({ root: fixture("npm-failure"), run: () => {
    calls += 1;
    return { status: 1, stderr: "private-registry-canary" };
  } }), (error) => error.code === "DEPENDENCY_INSTALL_FAILED" && !error.message.includes("canary"));
  assert.equal(calls, 1);
});

test("unsupported native runtime import returns a specific failure", () => {
  let calls = 0;
  assert.throws(() => setupRuntime({ root: fixture("import-failure"), run: () => ({ status: ++calls === 1 ? 0 : 1 }) }), { code: "RUNTIME_IMPORT_FAILED" });
});

test("Codex defaults, explicit CODEX_HOME and Claude paths remain distinct without creating state", () => {
  const cases = [
    ["codex-user", {}, resolve(temporary, "user/.agents/skills/memo-agent-did-mainnet")],
    ["codex-project", {}, resolve(temporary, ".agents/skills/memo-agent-did-mainnet")],
    ["codex-user", { CODEX_HOME: resolve(temporary, "custom-codex") }, resolve(temporary, "custom-codex/skills/memo-agent-did-mainnet")],
    ["claude-user", {}, resolve(temporary, "user/.claude/skills/memo-agent-did-mainnet")],
  ];
  for (const [target, env, destination] of cases) {
    const result = install(["--target", target, "--dry-run"], env);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).destination, destination);
    assert.equal(existsSync(destination), false);
  }
});

test("existing runtime installation is never overwritten implicitly", () => {
  const destination = resolve(temporary, "existing");
  mkdirSync(destination);
  writeFileSync(resolve(destination, "marker"), "keep");
  const result = install(["--target", "runtime", "--dest", destination]);
  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(resolve(destination, "marker"), "utf8"), "keep");
});

test("failed upgrade restores the complete previous installation", () => {
  const brokenBundle = resolve(temporary, "broken-bundle");
  cpSync(resolve(bundle, "scripts"), resolve(brokenBundle, "scripts"), { recursive: true });
  const brokenSkill = resolve(brokenBundle, "skills/memo-agent-did-mainnet");
  mkdirSync(resolve(brokenSkill, "scripts"), { recursive: true });
  cpSync(resolve(bundle, "skills/memo-agent-did-mainnet/scripts/setup-runtime.mjs"), resolve(brokenSkill, "scripts/setup-runtime.mjs"));
  const destination = resolve(temporary, "upgrade-failure");
  mkdirSync(destination);
  writeFileSync(resolve(destination, "marker"), "original");
  const result = spawnSync(process.execPath, [resolve(brokenBundle, "scripts/install.mjs"), "--target", "runtime", "--dest", destination, "--upgrade", "--json"], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /RUNTIME_PACKAGE_INCOMPLETE/);
  assert.equal(readFileSync(resolve(destination, "marker"), "utf8"), "original");
  assert.equal(existsSync(resolve(destination, "scripts/setup-runtime.mjs")), false);
});

test("installer rejects destinations overlapping its source", () => {
  const source = resolve(bundle, "skills/memo-agent-did-mainnet");
  for (const destination of [source, resolve(source, "nested"), resolve(bundle, "skills")]) {
    const result = install(["--target", "runtime", "--dest", destination, "--dry-run"]);
    assert.notEqual(result.status, 0);
  }
});
