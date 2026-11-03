export declare const CHAIN_ID = 985;
export declare const KEYRING_SERVICE = "com.memo.agent-did.mainnet";
export type KeyProviderName = "auto" | "os-keyring" | "env-master-key";
export type DeploymentEnvironment = "local" | "preprod" | "production";
export interface Config {
    home: string;
    dbPath: string;
    keyStorePath: string;
    apiUrl: string;
    apiOrigin: string;
    expectedChainId: 985;
    deploymentEnvironment: DeploymentEnvironment;
    installationId: string;
    keyProvider: KeyProviderName;
}
export declare function loadConfig(): Config;
