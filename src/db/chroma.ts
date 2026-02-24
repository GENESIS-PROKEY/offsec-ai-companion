// ChromaDB vector store connection with retry logic

import { ChromaClient, Collection } from 'chromadb';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

let client: ChromaClient;
let collection: Collection | null = null;
let isRagDisabled = false;
let lastRetryAt = 0;

const COLLECTION_NAME = 'offsec_knowledge';
const RETRY_INTERVAL_MS = 60_000; // Retry ChromaDB every 60 seconds

export async function getChromaCollection(): Promise<Collection | null> {
    if (isRagDisabled) {
        // Periodically retry instead of permanently disabling
        const now = Date.now();
        if (now - lastRetryAt < RETRY_INTERVAL_MS) return null;
        lastRetryAt = now;
        logger.info('🔄 Retrying ChromaDB connection...');
        isRagDisabled = false; // Reset to try again
    }

    if (!collection) {
        try {
            client = new ChromaClient({
                path: `http://${config.database.chromaHost}:${config.database.chromaPort}`,
            });

            // Test connection
            await client.listCollections();

            collection = await client.getOrCreateCollection({
                name: COLLECTION_NAME,
                metadata: {
                    description: 'OffSec AI Learning Companion knowledge base',
                    'hnsw:space': 'cosine',
                },
            });

            const count = await collection.count();
            logger.info({ collection: COLLECTION_NAME, documents: count }, '✅ ChromaDB connected');
        } catch (error) {
            logger.warn(
                { error: (error as Error).message },
                '⚠️ ChromaDB unavailable — will retry in 60s (is Docker running?)'
            );
            isRagDisabled = true;
            lastRetryAt = Date.now();
            return null;
        }
    }

    return collection;
}

/**
 * Add documents to the vector store.
 */
export async function addDocuments(
    ids: string[],
    embeddings: number[][],
    documents: string[],
    metadatas: Record<string, string | number>[]
): Promise<void> {
    const col = await getChromaCollection();
    if (!col) {
        logger.warn('Skipping document addition (ChromaDB unavailable)');
        return;
    }

    await col.add({ ids, embeddings, documents, metadatas });
    logger.info({ count: ids.length }, 'Documents added to ChromaDB');
}

/**
 * Query the vector store for similar documents.
 */
export async function queryDocuments(
    queryEmbedding: number[],
    nResults: number = 10,
    where?: Record<string, string>
): Promise<{
    ids: string[];
    documents: string[];
    metadatas: Record<string, unknown>[];
    distances: number[];
}> {
    const col = await getChromaCollection();

    if (!col) {
        return { ids: [], documents: [], metadatas: [], distances: [] };
    }

    try {
        const results = await col.query({
            queryEmbeddings: [queryEmbedding],
            nResults,
            where: where as Record<string, string>,
        });

        return {
            ids: (results.ids[0] ?? []) as string[],
            documents: (results.documents[0] ?? []) as string[],
            metadatas: (results.metadatas?.[0] ?? []) as Record<string, unknown>[],
            distances: (results.distances?.[0] ?? []) as number[],
        };
    } catch (error) {
        logger.error({ error }, 'ChromaDB query failed');
        collection = null; // Reset so it reconnects next time
        return { ids: [], documents: [], metadatas: [], distances: [] };
    }
}
