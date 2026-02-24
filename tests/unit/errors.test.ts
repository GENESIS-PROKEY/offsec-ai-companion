import { describe, it, expect } from 'vitest';
import { getErrorMessage, LLMError, MCPError, ConfigError, RAGRetrievalError, UserNotFoundError } from '../../src/utils/errors.js';

describe('getErrorMessage', () => {
    it('should extract message from Error instances', () => {
        expect(getErrorMessage(new Error('test error'))).toBe('test error');
    });

    it('should handle string errors', () => {
        expect(getErrorMessage('plain string')).toBe('plain string');
    });

    it('should handle null/undefined', () => {
        expect(getErrorMessage(null)).toBe('Unknown error');
        expect(getErrorMessage(undefined)).toBe('Unknown error');
    });

    it('should return Unknown error for plain objects', () => {
        // getErrorMessage only handles Error instances and strings
        expect(getErrorMessage({ message: 'object msg' })).toBe('Unknown error');
    });

    it('should return Unknown error for numbers', () => {
        expect(getErrorMessage(42)).toBe('Unknown error');
    });
});

describe('LLMError', () => {
    it('should create an error with provider (mcp) and message', () => {
        const err = new LLMError('gemini-1', 'rate limited');
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toContain('rate limited');
        expect(err.mcp).toBe('gemini-1');
        expect(err.code).toBe('LLM_CALL_FAILED');
        expect(err.name).toBe('LLMError');
    });

    it('should have proper prototype chain', () => {
        const err = new LLMError('all', 'failed');
        expect(err instanceof LLMError).toBe(true);
        expect(err instanceof MCPError).toBe(true);
        expect(err instanceof Error).toBe(true);
    });
});

describe('MCPError', () => {
    it('should create error with mcp and code', () => {
        const err = new MCPError('test-mcp', 'TEST_CODE', 'test message');
        expect(err.mcp).toBe('test-mcp');
        expect(err.code).toBe('TEST_CODE');
        expect(err.message).toBe('test message');
        expect(err.name).toBe('MCPError');
    });
});

describe('ConfigError', () => {
    it('should create a config error', () => {
        const err = new ConfigError('missing key');
        expect(err.message).toBe('missing key');
        expect(err.name).toBe('ConfigError');
        expect(err instanceof Error).toBe(true);
    });
});

describe('RAGRetrievalError', () => {
    it('should be an MCPError with rag mcp', () => {
        const err = new RAGRetrievalError('retrieval timeout');
        expect(err.mcp).toBe('rag');
        expect(err.code).toBe('RETRIEVAL_FAILED');
        expect(err.name).toBe('RAGRetrievalError');
    });
});

describe('UserNotFoundError', () => {
    it('should include userId in message', () => {
        const err = new UserNotFoundError('user-123');
        expect(err.message).toContain('user-123');
        expect(err.mcp).toBe('preference');
        expect(err.name).toBe('UserNotFoundError');
    });
});
