import { randomUUID } from "node:crypto";
export function success(action, data, operationId = null, warnings = []) {
    return { schema: "memo.agent-cli-result/2", ok: true, action, requestId: `req_${randomUUID()}`, operationId, data, warnings, error: null };
}
export function failure(action, error) {
    return {
        schema: "memo.agent-cli-result/2",
        ok: false,
        action,
        requestId: `req_${randomUUID()}`,
        operationId: null,
        data: null,
        warnings: [],
        error: { code: error.code, message: error.message, retryable: error.retryable, ...(error.details ? { details: error.details } : {}) },
    };
}
