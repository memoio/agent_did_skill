import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const skill = resolve(import.meta.dirname, "..");
const moduleUrl = pathToFileURL(resolve(skill, "src/local-state.mjs")).href;
function isolated(code, home) {
  return spawnSync(process.execPath, ["--input-type=module", "-e", `import { selectedState, claimDefault, listAgents, stateBase } from ${JSON.stringify(moduleUrl)}; ${code}`], {
    encoding: "utf8", env: { ...process.env, HOME: home, MEMO_AGENT_OPBNB_HOME: "" },
  });
}

test("independent Agent IDs have different directories and installation IDs", () => {
  const home = mkdtempSync(resolve(tmpdir(), "memo-agent-state-"));
  try {
    const result = isolated('const a=selectedState("agent-a",true),b=selectedState("agent-b",true); console.log(JSON.stringify({a:a.root,b:b.root,first:a.installationId,second:b.installationId,repeat:selectedState("agent-a").installationId}));', home);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.notEqual(output.a, output.b);
    assert.notEqual(output.first, output.second);
    assert.equal(output.first, output.repeat);
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test("CLI refuses identity commands without an explicit Agent ID", () => {
  const home = mkdtempSync(resolve(tmpdir(), "memo-agent-cli-"));
  try {
    const result = spawnSync(process.execPath, [resolve(skill, "bin/memo-agent-opbnb-testnet"), "identity", "status"], { encoding: "utf8", env: { ...process.env, HOME: home } });
    assert.notEqual(result.status, 0);
    assert.equal(JSON.parse(result.stdout).error.code, "AGENT_ID_REQUIRED");
    const unknown = spawnSync(process.execPath, [resolve(skill, "bin/memo-agent-opbnb-testnet"), "--agent", "unknown", "identity", "status"], { encoding: "utf8", env: { ...process.env, HOME: home, MEMO_AGENT_OPBNB_HOME: "" } });
    assert.equal(JSON.parse(unknown.stdout).error.code, "AGENT_NOT_INITIALIZED");
    assert.equal(existsSync(resolve(home, ".memo-agent-opbnb-testnet")), false);
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test("copying an installation marker cannot make two Agent IDs share a keyring entry", () => {
  const home = mkdtempSync(resolve(tmpdir(), "memo-agent-duplicate-"));
  try {
    const result = isolated(`
      const fs=await import("node:fs"),p=await import("node:path");
      const a=selectedState("agent-a",true),b=selectedState("agent-b",true);
      fs.writeFileSync(p.resolve(b.root,"installation-id"),a.installationId);
      try{selectedState("agent-b");process.exitCode=1;}catch(e){if(e.message!=="DUPLICATE_INSTALLATION_ID")process.exitCode=1;}
    `, home);
    assert.equal(result.status, 0, result.stderr);
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test("default identity can only be claimed once with its exact DID", () => {
  const home = mkdtempSync(resolve(tmpdir(), "memo-agent-claim-"));
  try {
    const result = isolated(`
      const fs=await import("node:fs"),p=await import("node:path");
      fs.mkdirSync(stateBase);fs.writeFileSync(p.resolve(stateBase,"installation-id"),"existing-installation");
      const did="did:memo:agent:5611:0x1111111111111111111111111111111111111111";
      fs.writeFileSync(p.resolve(stateBase,"identity.json"),JSON.stringify({schema:"memo.opbnb-agent-local/1",installationId:"existing-installation",did,address:"0x1111111111111111111111111111111111111111",publicKey:"existing-public-key"}));
      const other=selectedState("agent-b",true);
      fs.writeFileSync(p.resolve(other.root,"identity.json"),JSON.stringify({schema:"memo.opbnb-agent-local/1",agentId:"agent-b",installationId:other.installationId,did:"did:memo:agent:5611:0x2222222222222222222222222222222222222222"}));
      const unclaimed=listAgents().map(item=>item.source).join(",")==="unclaimed-default,named";
      let wrong=false,wrongKey=false,repeat=false;
      try{claimDefault("original","did:memo:agent:5611:0x2222222222222222222222222222222222222222",()=>true);}catch(e){wrong=e.message==="DEFAULT_IDENTITY_MISMATCH";}
      try{claimDefault("original",did,()=>false);}catch(e){wrongKey=e.message==="DEFAULT_IDENTITY_MISMATCH";}
      const claimed=claimDefault("original",did,(installationId,actualDid,address,publicKey)=>installationId==="existing-installation"&&actualDid===did&&address==="0x1111111111111111111111111111111111111111"&&publicKey==="existing-public-key");
      try{claimDefault("second",did,()=>true);}catch(e){repeat=e.message==="DEFAULT_IDENTITY_ALREADY_CLAIMED";}
      console.log(JSON.stringify({wrong,wrongKey,repeat,unclaimed,claimed:claimed.did,selected:selectedState("original").root===stateBase}));
    `, home);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { wrong: true, wrongKey: true, repeat: true, unclaimed: true, claimed: "did:memo:agent:5611:0x1111111111111111111111111111111111111111", selected: true });
  } finally { rmSync(home, { recursive: true, force: true }); }
});
