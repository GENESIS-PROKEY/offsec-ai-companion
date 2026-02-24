// Custom error classes for structured error handling

export class MCPError extends Error {
    public readonly mcp: string;
    public readonly code: string;

    constructor(mcp: string, code: string, message: string) {
        super(message);
        this.name = 'MCPError';
        this.mcp = mcp;
        this.code = code;
    }
}

export class ConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConfigError';
    }
}

export class RAGRetrievalError extends MCPError {
    constructor(message: string) {
        super('rag', 'RETRIEVAL_FAILED', message);
        this.name = 'RAGRetrievalError';
    }
}

export class LLMError extends MCPError {
    constructor(mcp: string, message: string) {
        super(mcp, 'LLM_CALL_FAILED', message);
        this.name = 'LLMError';
    }
}

export class UserNotFoundError extends MCPError {
    constructor(userId: string) {
        super('preference', 'USER_NOT_FOUND', `User ${userId} not found`);
        this.name = 'UserNotFoundError';
    }
}

/** Safely extract a message string from an unknown error */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Unknown error';
}
