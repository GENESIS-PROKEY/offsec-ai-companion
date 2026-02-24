import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Schema for a single Gemini provider slot
const geminiSlotSchema = z.object({
    apiKey: z.string().default(''),
    model: z.string().default(''),
});

const configSchema = z.object({
    discord: z.object({
        token: z.string().min(1, 'DISCORD_TOKEN is required'),
        clientId: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
    }),
    ai: z.object({
        // 6-tier Gemini fallback chain
        gemini1: geminiSlotSchema,
        gemini2: geminiSlotSchema,
        gemini3: geminiSlotSchema,
        gemini4: geminiSlotSchema,
        gemini5: geminiSlotSchema,
        gemini6: geminiSlotSchema,

        // Embedding settings
        embeddingApiKey: z.string().default(''),
        embeddingModel: z.string().default('gemini-embedding-001'),

        // Shared settings
        temperature: z.number().min(0).max(2).default(0.7),
        maxTokens: z.number().positive().default(4096),
    }),
    database: z.object({
        sqlitePath: z.string().default('./data/companion.db'),
        chromaHost: z.string().default('localhost'),
        chromaPort: z.number().default(8000),
    }),
    rag: z.object({
        topK: z.number().positive().default(10),
        rerankTop: z.number().positive().default(5),
        confidenceThreshold: z.number().min(0).max(1).default(0.6),
        chunkSize: z.number().positive().default(512),
        chunkOverlap: z.number().nonnegative().default(50),
    }),
    rateLimit: z.object({
        perUser: z.number().positive().default(10),
        windowMs: z.number().positive().default(60000),
    }),
    monitoring: z.object({
        healthPort: z.number().positive().default(3001),
    }),
});

export type AppConfig = z.infer<typeof configSchema>;

function loadFromEnv(): unknown {
    return {
        discord: {
            token: process.env.DISCORD_TOKEN ?? '',
            clientId: process.env.DISCORD_CLIENT_ID ?? '',
        },
        ai: {
            gemini1: {
                apiKey: process.env.GEMINI1_API_KEY ?? '',
                model: process.env.GEMINI1_MODEL ?? '',
            },
            gemini2: {
                apiKey: process.env.GEMINI2_API_KEY ?? '',
                model: process.env.GEMINI2_MODEL ?? '',
            },
            gemini3: {
                apiKey: process.env.GEMINI3_API_KEY ?? '',
                model: process.env.GEMINI3_MODEL ?? '',
            },
            gemini4: {
                apiKey: process.env.GEMINI4_API_KEY ?? '',
                model: process.env.GEMINI4_MODEL ?? '',
            },
            gemini5: {
                apiKey: process.env.GEMINI5_API_KEY ?? '',
                model: process.env.GEMINI5_MODEL ?? '',
            },
            gemini6: {
                apiKey: process.env.GEMINI6_API_KEY ?? '',
                model: process.env.GEMINI6_MODEL ?? '',
            },
            embeddingApiKey: process.env.GEMINI_EMBEDDING_API_KEY ?? process.env.GEMINI1_API_KEY ?? '',
            embeddingModel: process.env.GEMINI_EMBEDDING_MODEL,
            temperature: process.env.LLM_TEMPERATURE
                ? parseFloat(process.env.LLM_TEMPERATURE)
                : undefined,
            maxTokens: process.env.MAX_TOKENS
                ? parseInt(process.env.MAX_TOKENS, 10)
                : undefined,
        },
        database: {
            sqlitePath: process.env.SQLITE_PATH,
            chromaHost: process.env.CHROMA_HOST,
            chromaPort: process.env.CHROMA_PORT
                ? parseInt(process.env.CHROMA_PORT, 10)
                : undefined,
        },
        rag: {
            topK: process.env.RAG_TOP_K
                ? parseInt(process.env.RAG_TOP_K, 10)
                : undefined,
            rerankTop: process.env.RAG_RERANK_TOP
                ? parseInt(process.env.RAG_RERANK_TOP, 10)
                : undefined,
            confidenceThreshold: process.env.RAG_CONFIDENCE_THRESHOLD
                ? parseFloat(process.env.RAG_CONFIDENCE_THRESHOLD)
                : undefined,
            chunkSize: process.env.CHUNK_SIZE
                ? parseInt(process.env.CHUNK_SIZE, 10)
                : undefined,
            chunkOverlap: process.env.CHUNK_OVERLAP
                ? parseInt(process.env.CHUNK_OVERLAP, 10)
                : undefined,
        },
        rateLimit: {
            perUser: process.env.RATE_LIMIT_PER_USER
                ? parseInt(process.env.RATE_LIMIT_PER_USER, 10)
                : undefined,
            windowMs: process.env.RATE_LIMIT_WINDOW_MS
                ? parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10)
                : undefined,
        },
        monitoring: {
            healthPort: process.env.HEALTH_PORT
                ? parseInt(process.env.HEALTH_PORT, 10)
                : undefined,
        },
    };
}

export const config = configSchema.parse(loadFromEnv());
