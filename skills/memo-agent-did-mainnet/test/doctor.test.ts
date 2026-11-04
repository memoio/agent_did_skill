import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../src/config.js";
import { AgentDidService } from "../src/service.js";

const roots: string[] = [];
const services: AgentDidService[] = [];
const testMaster = "doctor-test-wrapping-key-canary-32-characters";

beforeEach(() => {
  vi.stubEnv("MEMO_AGENT_MAINNET_MASTER_KEY", "");
  vi.stubEnv("MEMO_AGENT_MAINNET_ALLOW_R2", "");
  vi.stubEnv("MEMO_AGENT_MAINNET_ALLOW_R4_TEST", "");
});

afterEach(() => {
  for (const service of services.splice(0)) service.close();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function createService(config?: Config): AgentDidService {
  if (!config) {
    const home = mkdtempSync(resolve(tmpdir(), "memo-doctor-test-"));
    roots.push(home);
    config = {
      home, dbPath: resolve(home, "state.sqlite"), keyStorePath: resolve(home, "keys.enc.json"),
      apiUrl: "http://127.0.0.1:1/", apiOrigin: "http://127.0.0.1:1", expectedChainId: 985,
      deploymentEnvironment: "local", installationId: "doctor-test", keyProvider: "auto",
    };
  }
  const service = new AgentDidService(config);
  services.push(service);
  return service;
}

function checks(doctor: Record<string, unknown>): Record<string, Record<string, unknown>> {
  return Object.fromEntries((doctor.checks as Record<string, unknown>[]).map((check) => [String(check.name), check]));
}

describe("identity readiness diagnostics", () => {
  it("reports missing storage without blaming platform configuration or chain grants", () => {
    const service = createService();
    vi.spyOn(service.signer, "keyringAvailable").mockReturnValue(false);
    const doctor = service.doctor();
    expect(doctor).toMatchObject({ ready: false, identityStorageReady: false, blockingChecks: ["secureStorageReady"], platformConnectivityChecked: false });
    expect(checks(doctor).keyProvider).toMatchObject({ ok: false, value: "unavailable" });
    expect(checks(doctor).masterKey.ok).toBe(false);
    expect(checks(doctor).r2ServiceGrant.ok).toBe(false);
    expect(checks(doctor).r4TestGrant.ok).toBe(false);
    expect(JSON.stringify(doctor.guidance)).toContain("Offline identity creation does not require a reachable platform API or R2/R4 grants");
    expect(() => service.ensureIdentity()).toThrowError(/OS keyring is unavailable/);
    expect(service.status()).toMatchObject({ exists: false });
    expect(existsSync(service.config.keyStorePath)).toBe(false);
    expect(JSON.stringify(doctor)).not.toContain(service.config.home);
  });

  it("accepts available OS storage without an environment master key or R2/R4", () => {
    const service = createService();
    vi.spyOn(service.signer, "keyringAvailable").mockReturnValue(true);
    const doctor = service.doctor();
    expect(doctor).toMatchObject({ ready: true, identityStorageReady: true, blockingChecks: [], platformConnectivityChecked: false });
    expect(checks(doctor).keyProvider).toMatchObject({ ok: true, value: "os-keyring" });
    expect(checks(doctor).masterKey.ok).toBe(false);
    expect(service.status()).toMatchObject({ exists: false });
    expect(existsSync(service.config.keyStorePath)).toBe(false);
  });

  it("supports configured wrapping input and reuses identity offline across service restarts", () => {
    vi.stubEnv("MEMO_AGENT_MAINNET_MASTER_KEY", testMaster);
    const fetch = vi.fn(() => { throw new Error("Network must not be contacted"); });
    vi.stubGlobal("fetch", fetch);
    const first = createService();
    vi.spyOn(first.signer, "keyringAvailable").mockReturnValue(false);
    const doctor = first.doctor();
    expect(doctor).toMatchObject({ ready: true, identityStorageReady: true, blockingChecks: [], platformConnectivityChecked: false });
    expect(checks(doctor).keyProvider.value).toBe("env-master-key");
    const identity = first.ensureIdentity();
    first.close();
    services.splice(services.indexOf(first), 1);
    const second = createService(first.config);
    vi.spyOn(second.signer, "keyringAvailable").mockReturnValue(false);
    expect(second.doctor().ready).toBe(true);
    expect(second.ensureIdentity()).toMatchObject({ agentDid: identity.agentDid, publicKey: identity.publicKey, reused: true });
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.stringify(doctor)).not.toContain(testMaster);
    expect(JSON.stringify(doctor)).not.toContain(first.config.home);
  });

  it("rejects short wrapping input even though the masterKey presence check is true", () => {
    vi.stubEnv("MEMO_AGENT_MAINNET_MASTER_KEY", "short");
    const service = createService();
    vi.spyOn(service.signer, "keyringAvailable").mockReturnValue(false);
    const doctor = service.doctor();
    expect(checks(doctor).masterKey.ok).toBe(true);
    expect(doctor).toMatchObject({ ready: false, identityStorageReady: false, blockingChecks: ["secureStorageReady"] });
    expect(existsSync(service.config.keyStorePath)).toBe(false);
  });

  it("preserves an existing identity when access to its wrapping key is lost", () => {
    vi.stubEnv("MEMO_AGENT_MAINNET_MASTER_KEY", testMaster);
    const service = createService();
    vi.spyOn(service.signer, "keyringAvailable").mockReturnValue(false);
    const identity = service.ensureIdentity();
    const encrypted = readFileSync(service.config.keyStorePath, "utf8");
    vi.stubEnv("MEMO_AGENT_MAINNET_MASTER_KEY", "");
    const doctor = service.doctor();
    expect(doctor.ready).toBe(false);
    expect(JSON.stringify(doctor.guidance)).toContain("Preserve the existing identity state, provider and wrapping key");
    expect(JSON.stringify(doctor.guidance)).not.toContain("administrator may explicitly supply");
    expect(() => service.ensureIdentity()).toThrowError(/MASTER_KEY/);
    expect(service.status()).toMatchObject({ agentDid: identity.agentDid, state: "QUARANTINED", keyProvider: "env-master-key" });
    expect(readFileSync(service.config.keyStorePath, "utf8")).toBe(encrypted);
  });

  it("retains file permissions in the existing required-check calculation", () => {
    const service = createService();
    vi.spyOn(service.signer, "keyringAvailable").mockReturnValue(true);
    chmodSync(service.config.dbPath, 0o644);
    expect(service.doctor()).toMatchObject({ ready: false, identityStorageReady: true, blockingChecks: ["stateStoreMode"] });
  });

  it("preserves the doctor JSON schema and exit status when storage is unavailable", () => {
    const home = mkdtempSync(resolve(tmpdir(), "memo-doctor-cli-"));
    roots.push(home);
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("MEMO_AGENT_MAINNET_")));
    Object.assign(env, {
      MEMO_AGENT_MAINNET_HOME: home, MEMO_AGENT_MAINNET_INSTALLATION_ID: "doctor-cli",
      MEMO_AGENT_MAINNET_ENVIRONMENT: "local", MEMO_AGENT_MAINNET_KEY_PROVIDER: "env-master-key",
      MEMO_AGENT_MAINNET_API_URL: "http://127.0.0.1:1",
    });
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("../bin/memo-agent-mainnet", import.meta.url)), "doctor", "--json"], { env, encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout.trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ schema: "memo.agent-cli-result/2", ok: true, error: null, data: { ready: false, identityStorageReady: false, platformConnectivityChecked: false, blockingChecks: ["secureStorageReady"] } });
    expect(result.stdout).not.toContain(home);
    expect(existsSync(resolve(home, "agents/doctor-cli/keys.enc.json"))).toBe(false);
  });
});
