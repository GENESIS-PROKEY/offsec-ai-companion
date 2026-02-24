// Bulk knowledge ingestion script
// Usage: npx tsx scripts/ingest.ts

import { IngestionMCP } from '../src/mcp/ingestion/index.js';
import { logger } from '../src/utils/logger.js';
import fs from 'fs';
import path from 'path';

const KNOWLEDGE_DIR = path.resolve('data/knowledge');

interface SourceConfig {
    dir: string;
    category: string;
    extensions: string[];
}

const SOURCES: SourceConfig[] = [
    { dir: 'glossary', category: 'glossary', extensions: ['.md', '.txt', '.json'] },
    { dir: 'owasp', category: 'owasp', extensions: ['.md', '.txt'] },
    { dir: 'kali', category: 'tools', extensions: ['.md', '.txt'] },
    { dir: 'offsec-modules', category: 'courses', extensions: ['.md', '.txt', '.json'] },
];

async function main() {
    logger.info('🔄 Starting knowledge ingestion...');

    const ingestionMCP = new IngestionMCP();
    let totalChunks = 0;
    let totalDocs = 0;
    let totalErrors = 0;

    for (const source of SOURCES) {
        const dirPath = path.join(KNOWLEDGE_DIR, source.dir);

        if (!fs.existsSync(dirPath)) {
            logger.warn({ dir: dirPath }, 'Source directory not found, skipping');
            continue;
        }

        const files = fs.readdirSync(dirPath).filter((f) =>
            source.extensions.some((ext) => f.endsWith(ext))
        );

        logger.info({ dir: source.dir, files: files.length }, 'Processing source directory');

        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const content = fs.readFileSync(filePath, 'utf-8');

            const result = await ingestionMCP.execute({
                action: 'ingest',
                payload: {
                    source: 'file',
                    content,
                    metadata: {
                        source: file,
                        title: path.basename(file, path.extname(file)).replace(/[-_]/g, ' '),
                        category: source.category,
                        chunkIndex: 0,
                        totalChunks: 0,
                        ingestedAt: new Date().toISOString(),
                    },
                },
                context: {
                    userId: 'system',
                    username: 'ingestion-script',
                    preferredLevel: 'expert',
                    detectedLevel: 'expert',
                    preferredStyle: 'detailed',
                    recentHistory: [],
                },
            });

            if (result.success) {
                totalChunks += result.data.chunksCreated;
                totalDocs += result.data.documentsIndexed;
                totalErrors += result.data.errors.length;
                logger.info(
                    { file, chunks: result.data.chunksCreated },
                    'File ingested'
                );
            } else {
                totalErrors++;
                logger.error({ file }, 'File ingestion failed');
            }
        }
    }

    logger.info(
        { totalDocs, totalChunks, totalErrors },
        '✅ Ingestion complete'
    );
}

main().catch((err) => {
    logger.fatal({ err }, 'Ingestion script failed');
    process.exit(1);
});
