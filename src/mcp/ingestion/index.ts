// Knowledge Ingestion MCP — document loading, chunking, embedding, and indexing

import { BaseMCP } from '../base.js';
import type { MCPRequest, DocumentMetadata } from '../../types/index.js';
import { generateEmbeddings } from '../../services/ai.js';
import { addDocuments } from '../../db/chroma.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

interface IngestionPayload {
    source: 'file' | 'url' | 'text';
    content: string;
    metadata: Partial<DocumentMetadata>;
    chunkConfig?: { chunkSize?: number; chunkOverlap?: number };
}

interface IngestionResult {
    chunksCreated: number;
    documentsIndexed: number;
    errors: string[];
}

export class IngestionMCP extends BaseMCP<IngestionPayload, IngestionResult> {
    constructor() {
        super('IngestionMCP');
    }

    protected async handle(request: MCPRequest<IngestionPayload>): Promise<IngestionResult> {
        const { content, metadata, chunkConfig } = request.payload;
        const errors: string[] = [];

        // Step 1: Clean and normalize text
        const cleanedContent = this.cleanText(content);

        if (cleanedContent.length === 0) {
            return { chunksCreated: 0, documentsIndexed: 0, errors: ['Empty content after cleaning'] };
        }

        // Step 2: Chunk the content
        const chunkSize = chunkConfig?.chunkSize ?? config.rag.chunkSize;
        const chunkOverlap = chunkConfig?.chunkOverlap ?? config.rag.chunkOverlap;
        const chunks = this.chunkText(cleanedContent, chunkSize, chunkOverlap);

        logger.info(
            { source: metadata.source, chunks: chunks.length, chunkSize, chunkOverlap },
            'Document chunked'
        );

        // Step 3: Generate embeddings in batches
        const batchSize = 100;
        const allIds: string[] = [];
        const allEmbeddings: number[][] = [];
        const allDocuments: string[] = [];
        const allMetadatas: Record<string, string | number>[] = [];

        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);

            try {
                const embeddings = await generateEmbeddings(batch);

                for (let j = 0; j < batch.length; j++) {
                    const chunkIndex = i + j;
                    allIds.push(uuidv4());
                    allEmbeddings.push(embeddings[j]);
                    allDocuments.push(batch[j]);
                    allMetadatas.push({
                        source: metadata.source ?? 'unknown',
                        title: metadata.title ?? 'Untitled',
                        category: metadata.category ?? 'general',
                        url: metadata.url ?? '',
                        chunkIndex,
                        totalChunks: chunks.length,
                        ingestedAt: new Date().toISOString(),
                    });
                }
            } catch (err) {
                const errMsg = `Embedding batch ${i}-${i + batch.length} failed: ${err}`;
                errors.push(errMsg);
                logger.error({ err, batch: i }, 'Embedding batch failed');
            }
        }

        // Step 4: Store in ChromaDB
        if (allIds.length > 0) {
            try {
                await addDocuments(allIds, allEmbeddings, allDocuments, allMetadatas);
            } catch (err) {
                errors.push(`ChromaDB storage failed: ${err}`);
                logger.error({ err }, 'ChromaDB storage failed');
            }
        }

        return {
            chunksCreated: allIds.length,
            documentsIndexed: allIds.length > 0 ? 1 : 0,
            errors,
        };
    }

    /**
     * Clean and normalize text content.
     */
    private cleanText(text: string): string {
        return text
            .replace(/\r\n/g, '\n')           // Normalize line endings
            .replace(/\n{3,}/g, '\n\n')       // Collapse multiple blank lines
            .replace(/\t/g, '  ')             // Tabs to spaces
            .replace(/[^\S\n]+/g, ' ')        // Collapse whitespace (preserve newlines)
            .trim();
    }

    /**
     * Recursive character text splitting.
     * Chunks at ~chunkSize chars with overlap.
     */
    private chunkText(text: string, chunkSize: number, overlap: number): string[] {
        // Convert token-based sizes to approximate character counts (1 token ≈ 4 chars)
        const charSize = chunkSize * 4;
        const charOverlap = overlap * 4;

        const chunks: string[] = [];
        const separators = ['\n\n', '\n', '. ', ' '];

        const splitRecursive = (text: string, separatorIndex: number): string[] => {
            if (text.length <= charSize) return [text];

            const separator = separators[separatorIndex] ?? '';
            const parts = text.split(separator);
            const results: string[] = [];
            let current = '';

            for (const part of parts) {
                const candidate = current ? current + separator + part : part;

                if (candidate.length > charSize && current) {
                    results.push(current.trim());
                    // Keep overlap
                    const overlapText = current.slice(-charOverlap);
                    current = overlapText + separator + part;
                } else {
                    current = candidate;
                }
            }

            if (current.trim()) results.push(current.trim());

            // If chunks are still too large, recurse with next separator
            if (separatorIndex < separators.length - 1) {
                const refined: string[] = [];
                for (const chunk of results) {
                    if (chunk.length > charSize) {
                        refined.push(...splitRecursive(chunk, separatorIndex + 1));
                    } else {
                        refined.push(chunk);
                    }
                }
                return refined;
            }

            return results;
        };

        return splitRecursive(text, 0).filter((c) => c.length > 20); // Filter tiny fragments
    }
}
