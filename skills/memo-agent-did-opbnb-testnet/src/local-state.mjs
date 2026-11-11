import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

export const stateBase = resolve(homedir(), ".memo-agent-opbnb-testnet");
const claimPath = resolve(stateBase, "agent-claim.json");
const agentsRoot = resolve(stateBase, "agents");

export function validateAgentId(id) {
  if (typeof id !== "string" || !/^[a-z][a-z0-9-]{0,31}$/.test(id) || id.endsWith("-")) throw Error("INVALID_AGENT_ID");
  return id;
}

export function generateAgentId() {
  if (process.env.MEMO_AGENT_OPBNB_HOME) throw Error("LEGACY_HOME_UNSUPPORTED_USE_AGENT_ID");
  const claimedId = claim()?.agentId;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const id = `agent-${randomBytes(12).toString("hex")}`;
    if (id !== claimedId && !existsSync(resolve(agentsRoot, id))) return id;
  }
  throw Error("AGENT_ID_GENERATION_FAILED");
}

function claim() {
  if (!existsSync(claimPath)) return null;
  const value = JSON.parse(readFileSync(claimPath, "utf8"));
  if (value.schema !== "memo.agent-default-claim/1" || !validateAgentId(value.agentId)) throw Error("STATE_NAMESPACE_CONFLICT");
  return value;
}

function identity(root) {
  const path = resolve(root, "identity.json");
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

export function selectedState(id, create = false) {
  validateAgentId(id);
  if (process.env.MEMO_AGENT_OPBNB_HOME) throw Error("LEGACY_HOME_UNSUPPORTED_USE_AGENT_ID");
  const isDefault = claim()?.agentId === id;
  const root = isDefault ? stateBase : resolve(agentsRoot, id);
  if (create && !existsSync(root)) {
    mkdirSync(agentsRoot, { recursive: true, mode: 0o700 });
    mkdirSync(root, { mode: 0o700 });
  }
  if (!existsSync(root) || !lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) throw Error("AGENT_NOT_INITIALIZED");
  const saved = identity(root);
  if (saved && (saved.schema !== "memo.opbnb-agent-local/1" || (isDefault ? saved.agentId && saved.agentId !== id : saved.agentId !== id))) throw Error("STATE_NAMESPACE_CONFLICT");
  if (!saved && readdirSync(root).some(name => !["offers", "installation-id", ".DS_Store"].includes(name))) throw Error("STATE_NAMESPACE_CONFLICT");
  const marker = resolve(root, "installation-id");
  if (!existsSync(marker)) {
    if (!create) throw Error("AGENT_NOT_INITIALIZED");
    writeFileSync(marker, randomUUID(), { mode: 0o600, flag: "wx" });
  }
  const installationId = readFileSync(marker, "utf8").trim();
  if (!installationId || (saved?.installationId && saved.installationId !== installationId)) throw Error("STATE_NAMESPACE_CONFLICT");
  const otherRoots = [stateBase, ...(existsSync(agentsRoot) ? readdirSync(agentsRoot).map(name => resolve(agentsRoot, name)) : [])];
  for (const other of otherRoots) {
    if (other === root || !existsSync(other) || !lstatSync(other).isDirectory() || lstatSync(other).isSymbolicLink()) continue;
    const otherMarker = resolve(other, "installation-id");
    if (existsSync(otherMarker) && readFileSync(otherMarker, "utf8").trim() === installationId) throw Error("DUPLICATE_INSTALLATION_ID");
  }
  return { id, root, meta: resolve(root, "identity.json"), installationId, isDefault };
}

export function claimDefault(id, expectedDid, verifyKey) {
  validateAgentId(id);
  if (process.env.MEMO_AGENT_OPBNB_HOME) throw Error("LEGACY_HOME_UNSUPPORTED_USE_AGENT_ID");
  if (claim()) throw Error("DEFAULT_IDENTITY_ALREADY_CLAIMED");
  if (existsSync(resolve(agentsRoot, id))) throw Error("AGENT_ID_ALREADY_EXISTS");
  const saved = identity(stateBase);
  if (saved?.schema !== "memo.opbnb-agent-local/1" || saved.did !== expectedDid) throw Error("DEFAULT_IDENTITY_MISMATCH");
  const marker = resolve(stateBase, "installation-id");
  if (!existsSync(marker) || readFileSync(marker, "utf8").trim() !== saved.installationId) throw Error("DEFAULT_IDENTITY_MISMATCH");
  if (!saved.publicKey || !verifyKey(saved.installationId, saved.did, saved.address, saved.publicKey)) throw Error("DEFAULT_IDENTITY_MISMATCH");
  writeFileSync(claimPath, JSON.stringify({ schema: "memo.agent-default-claim/1", agentId: id, did: saved.did }) + "\n", { mode: 0o600, flag: "wx" });
  return { agentId: id, did: saved.did, stateDirectory: stateBase };
}

export function listAgents() {
  const result = [];
  const currentClaim = claim();
  if (currentClaim) result.push({ agentId: currentClaim.agentId, did: currentClaim.did, stateDirectory: stateBase, source: "claimed-default" });
  else {
    const existing = identity(stateBase);
    if (existing?.did) result.push({ agentId: null, did: existing.did, stateDirectory: stateBase, source: "unclaimed-default" });
  }
  if (existsSync(agentsRoot)) for (const id of readdirSync(agentsRoot)) {
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(id)) continue;
    const root = resolve(agentsRoot, id);
    if (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) continue;
    const saved = identity(root);
    if (saved?.agentId === id) result.push({ agentId: id, did: saved.did, stateDirectory: root, source: "named" });
  }
  return result.sort((a, b) => (a.agentId ?? "").localeCompare(b.agentId ?? ""));
}
