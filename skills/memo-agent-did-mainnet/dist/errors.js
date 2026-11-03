export class AgentError extends Error {
    code;
    retryable;
    details;
    constructor(code, message, retryable = false, details) {
        super(message);
        this.code = code;
        this.retryable = retryable;
        this.details = details;
        this.name = "AgentError";
    }
}
export function asAgentError(error) {
    if (error instanceof AgentError)
        return error;
    return new AgentError("INTERNAL_ERROR", error instanceof Error ? error.message : String(error));
}
