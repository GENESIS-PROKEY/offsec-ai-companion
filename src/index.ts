// Application entry point

import { startBot } from './bot/client.js';
import { startHealthServer } from './services/health.js';
import { logger } from './utils/logger.js';

async function main() {
    logger.info('🛡️  OffSec AI Learning Companion starting...');

    try {
        await startBot();
        startHealthServer();
        logger.info('✅ All systems ready');
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.fatal({
            error: err.message,
            code: (error as NodeJS.ErrnoException)?.code,
            stack: err.stack,
        }, '❌ Failed to start');
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('Shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Shutting down...');
    process.exit(0);
});

main();
