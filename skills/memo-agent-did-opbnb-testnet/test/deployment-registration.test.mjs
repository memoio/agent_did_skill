import { test } from "node:test";
import assert from "node:assert/strict";
import { Wallet } from "ethers";
import { builtInDeployment, deploymentSettings, verifyChainConfig } from "../src/deployment.mjs";
import { expectedDocument, validateRegistrationFiles } from "../src/registration.mjs";

test("built-in public deployment is pinned and partial overrides fail", () => {
  const defaults = deploymentSettings({});
  assert.equal(defaults.source, "built-in");
  assert.equal(defaults.chainId, 5611);
  assert.equal(defaults.didRegistry, builtInDeployment.didRegistry);
  assert.throws(() => deploymentSettings({ MEMO_AGENT_OPBNB_API_URL: "https://example.com" }), /PLATFORM_CONFIG_INCOMPLETE/);
  const custom = deploymentSettings({ MEMO_AGENT_OPBNB_API_URL: "https://example.com", MEMO_AGENT_OPBNB_DID_REGISTRY: builtInDeployment.didRegistry, MEMO_AGENT_OPBNB_MANAGEMENT_REGISTRY: builtInDeployment.managementRegistry });
  assert.equal(custom.source, "explicit");
  const response = { deploymentId: defaults.deploymentId, network: { chainId: 5611, caip2: "eip155:5611", genesisHash: defaults.genesisHash }, contracts: { didRegistry: { address: defaults.didRegistry }, managementRegistry: { address: defaults.managementRegistry } } };
  assert.equal(verifyChainConfig(defaults, response), response);
  assert.throws(() => verifyChainConfig(defaults, { ...response, deploymentId: "other" }), /DEPLOYMENT_MISMATCH/);
  assert.throws(() => verifyChainConfig(defaults, { ...response, network: { ...response.network, chainId: 1 } }), /NETWORK_MISMATCH/);
  assert.throws(() => verifyChainConfig(defaults, { ...response, contracts: { ...response.contracts, didRegistry: { address: "0x1111111111111111111111111111111111111111" } } }), /REGISTRY_MISMATCH/);
});

test("generated DID document binds the new key and incomplete Profile cannot register", () => {
  const wallet = Wallet.createRandom(), did = `did:memo:agent:5611:${wallet.address.toLowerCase()}`;
  const document = expectedDocument(did, wallet.signingKey.publicKey);
  assert.equal(document.id, did);
  assert.equal(document.verificationMethod[0].publicKeyHex, wallet.signingKey.publicKey);
  assert.doesNotThrow(() => validateRegistrationFiles({ name: "agent-b", description: "Independent test agent" }, document, did, wallet.signingKey.publicKey));
  assert.throws(() => validateRegistrationFiles({ name: "agent-b", description: "" }, document, did, wallet.signingKey.publicKey), /PROFILE_REVIEW_REQUIRED/);
  assert.throws(() => validateRegistrationFiles({ name: "agent-b", description: "Ready" }, { ...document, id: "different" }, did, wallet.signingKey.publicKey), /DID_DOCUMENT_MISMATCH/);
});
