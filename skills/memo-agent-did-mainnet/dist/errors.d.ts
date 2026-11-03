export declare class AgentError extends Error {
    readonly code: string;
    readonly retryable: boolean;
    readonly details?: Record<string, unknown> | undefined;
    constructor(code: string, message: string, retryable?: boolean, details?: Record<string, unknown> | undefined);
}
export declare function asAgentError(error: unknown): AgentError;
