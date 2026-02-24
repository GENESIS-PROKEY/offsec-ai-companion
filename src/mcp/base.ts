// Abstract base class for all MCP modules
// Enforces a consistent interface for orchestration

import type { MCPRequest, MCPResponse, UserContext } from '../types/index.js';
import { logger } from '../utils/logger.js';

export abstract class BaseMCP<TPayload = Record<string, unknown>, TResult = unknown> {
    public readonly name: string;

    constructor(name: string) {
        this.name = name;
    }

    /**
     * Execute the MCP's primary action.
     * Subclasses implement `handle()` with their specific logic.
     */
    async execute(request: MCPRequest<TPayload>): Promise<MCPResponse<TResult>> {
        const start = Date.now();
        try {
            logger.info({ mcp: this.name, action: request.action }, `MCP ${this.name} executing`);

            const data = await this.handle(request);

            const latencyMs = Date.now() - start;
            logger.info({ mcp: this.name, latencyMs }, `MCP ${this.name} completed`);

            return {
                success: true,
                data,
                metadata: {
                    latencyMs,
                    source: this.name,
                    confidence: this.getConfidence(data),
                },
            };
        } catch (error) {
            const latencyMs = Date.now() - start;
            logger.error({ mcp: this.name, error, latencyMs }, `MCP ${this.name} failed`);

            return {
                success: false,
                data: null as unknown as TResult,
                metadata: {
                    latencyMs,
                    source: this.name,
                    confidence: 0,
                },
            };
        }
    }

    /**
     * Core handler — implemented by each MCP subclass.
     */
    protected abstract handle(request: MCPRequest<TPayload>): Promise<TResult>;

    /**
     * Override to provide a confidence score for the result.
     * Default: 1.0 (fully confident).
     */
    protected getConfidence(_data: TResult): number {
        return 1.0;
    }

    /**
     * Health check — override for custom checks (e.g., DB connectivity).
     */
    async healthCheck(): Promise<boolean> {
        return true;
    }
}
