import type { AgentError } from "./errors.js";
export interface Envelope {
    schema: "memo.agent-cli-result/2";
    ok: boolean;
    action: string;
    requestId: string;
    operationId: string | null;
    data: unknown;
    warnings: string[];
    error: null | {
        code: string;
        message: string;
        retryable: boolean;
        details?: Record<string, unknown>;
    };
}
export declare function success(action: string, data: unknown, operationId?: string | null, warnings?: string[]): Envelope;
export declare function failure(action: string, error: AgentError): Envelope;
