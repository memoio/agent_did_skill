import { getAddress } from "ethers";

export const builtInDeployment = Object.freeze({
  deploymentId: "opbnb-agentdid-20261109-a",
  apiUrl: "https://agent-did-test.memolabs.net",
  chainId: 5611,
  genesisHash: "0x51fa57729dfb1c27542c21b06cb72a0459c57440ceb43a465dae1307cd04fe80",
  didRegistry: "0x456Df7c0C189BF0187a8c0A70c713F8Da609c9d7",
  managementRegistry: "0x9e589B142543ea9E15eE25C53823354319dB3929",
});

export function deploymentSettings(environment = process.env) {
  const keys = ["MEMO_AGENT_OPBNB_API_URL", "MEMO_AGENT_OPBNB_DID_REGISTRY", "MEMO_AGENT_OPBNB_MANAGEMENT_REGISTRY"];
  const provided = keys.filter(key => Boolean(environment[key]));
  if (provided.length && provided.length !== keys.length) throw Error("PLATFORM_CONFIG_INCOMPLETE");
  if (!provided.length) return { ...builtInDeployment, source: "built-in" };
  return {
    ...builtInDeployment,
    apiUrl: environment.MEMO_AGENT_OPBNB_API_URL,
    didRegistry: environment.MEMO_AGENT_OPBNB_DID_REGISTRY,
    managementRegistry: environment.MEMO_AGENT_OPBNB_MANAGEMENT_REGISTRY,
    deploymentId: null,
    source: "explicit",
  };
}

export function verifyChainConfig(expected, actual) {
  if (actual?.network?.chainId !== expected.chainId || actual.network.caip2 !== `eip155:${expected.chainId}` || actual.network.genesisHash?.toLowerCase() !== expected.genesisHash) throw Error("NETWORK_MISMATCH");
  if (expected.deploymentId && actual.deploymentId !== expected.deploymentId) throw Error("DEPLOYMENT_MISMATCH");
  for (const kind of ["didRegistry", "managementRegistry"]) {
    try { if (getAddress(actual.contracts[kind].address) !== getAddress(expected[kind])) throw Error(); }
    catch { throw Error("REGISTRY_MISMATCH"); }
  }
  return actual;
}
