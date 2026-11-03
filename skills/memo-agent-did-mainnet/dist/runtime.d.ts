import { type Config } from "./config.js";
export interface RuntimeBootstrapResult {
    doctor: Record<string, unknown>;
    ensure: Record<string, unknown>;
    status: Record<string, unknown>;
}
/**
 * Runtime adapters call this once during startup. It is intentionally offline:
 * doctor, identity ensure, and status never register, pair, or create an owner
 * relationship. Network access begins only when an explicit chain command runs.
 */
export declare function bootstrapMemoAgentMainnetRuntime(config?: Config): Promise<RuntimeBootstrapResult>;
