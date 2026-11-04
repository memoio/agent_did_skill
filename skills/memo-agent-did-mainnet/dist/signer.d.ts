import { type Config } from "./config.js";
type Field = {
    name: string;
    type: string;
};
export declare const ACTION_REGISTRY: Record<string, Field[]>;
export declare const TYPED_DOMAIN: {
    readonly name: "MEMO Agent DID Offchain";
    readonly version: "2";
    readonly chainId: 985;
};
export interface SignerKms {
    readonly providerName: "os-keyring" | "env-master-key";
    ensureKey(kind: "identity" | "instance", handle: string): {
        handle: string;
        publicKey: string;
        address: string;
    };
    createKey(kind: "identity" | "instance"): {
        handle: string;
        publicKey: string;
        address: string;
    };
    putSecret(value: string): string;
    readSecret(handle: string): string;
    destroy(handle: string): void;
    getPublic(handle: string): {
        publicKey: string;
        address: string;
    };
    signTypedAction(handle: string, actionType: string, payload: Record<string, unknown>, domain?: Record<string, unknown>): Promise<{
        signature: string;
        digest: string;
        publicKey: string;
        address: string;
        auditId: string;
    }>;
    signSessionChallenge(handle: string, message: string, expectedDid: string, expectedChallengeId: string): Promise<string>;
}
export declare class LocalKmsSigner implements SignerKms {
    private readonly config;
    constructor(config: Config);
    private keyringEntry;
    keyringAvailable(): boolean;
    private selectNewProvider;
    get providerName(): "os-keyring" | "env-master-key";
    secureStorageReady(): boolean;
    private wrappingKey;
    private readExisting;
    private read;
    private write;
    private encryptFor;
    private decryptFrom;
    ensureKey(kind: "identity" | "instance", handle: string): {
        handle: string;
        publicKey: string;
        address: string;
    };
    createKey(kind: "identity" | "instance"): {
        handle: string;
        publicKey: string;
        address: string;
    };
    putSecret(value: string): string;
    readSecret(handle: string): string;
    destroy(handle: string): void;
    getPublic(handle: string): {
        publicKey: string;
        address: string;
    };
    migrateToOsKeyring(): {
        from: string;
        to: "os-keyring";
        migratedEntries: number;
    };
    signTypedAction(handle: string, actionType: string, payload: Record<string, unknown>, domain?: Record<string, unknown>): Promise<{
        signature: string;
        digest: string;
        publicKey: string;
        address: string;
        auditId: string;
    }>;
    signSessionChallenge(handle: string, message: string, expectedDid: string, expectedChallengeId: string): Promise<string>;
}
/** @deprecated Use LocalKmsSigner. Kept for source compatibility with 0.2 clients. */
export declare class EncryptedFileSigner extends LocalKmsSigner {
}
export {};
