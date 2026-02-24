// Shared type definitions for the OffSec AI Learning Companion

import type { Level, ExplanationStyle } from '../config/constants.js';

// ─── MCP Communication ──────────────────────────────────────────────

export interface MCPRequest<T = Record<string, unknown>> {
    action: string;
    payload: T;
    context: UserContext;
}

export interface MCPResponse<T = unknown> {
    success: boolean;
    data: T;
    metadata: {
        latencyMs: number;
        source: string;
        confidence: number;
    };
}

// ─── User ────────────────────────────────────────────────────────────

export interface UserContext {
    userId: string;
    username: string;
    preferredLevel: Level;
    detectedLevel: Level;
    preferredStyle: ExplanationStyle;
    recentHistory: InteractionRecord[];
    historySummary?: string;
}

export interface UserProfile {
    userId: string;
    username: string;
    createdAt: string;
    lastActiveAt: string;

    // Preferences
    preferredLevel: Level;
    detectedLevel: Level;
    preferredStyle: ExplanationStyle;
    topicsOfInterest: string[];

    // Learning metrics
    totalInteractions: number;
    conceptsExplored: string[];
    questionsAsked: number;
    streakDays: number;
    lastStreakDate: string;

    // Privacy
    dataRetention: 'full' | 'minimal' | 'none';
    optedInToAnalytics: boolean;
}

// ─── Interactions ────────────────────────────────────────────────────

export interface InteractionRecord {
    id: string;
    userId: string;
    command: string;
    query: string;
    response: string;
    level: Level;
    confidence: number;
    timestamp: string;
    topics: string[];
}

// ─── RAG / Citations ─────────────────────────────────────────────────

export interface Citation {
    text: string;
    source: string;
    url?: string;
    page?: number;
    relevance: number;
}

export interface RAGResult {
    answer: string;
    sources: Citation[];
    confidence: number;
    suggestedFollowups: string[];
    keyTakeaways?: string[];
}

export interface DocumentChunk {
    id: string;
    content: string;
    metadata: DocumentMetadata;
    embedding?: number[];
}

export interface DocumentMetadata {
    source: string;
    title: string;
    category: string;
    url?: string;
    page?: number;
    chunkIndex: number;
    totalChunks: number;
    ingestedAt: string;
}

// ─── Explain ─────────────────────────────────────────────────────────

export interface ExplainResult {
    explanation: string;
    analogies: string[];
    relatedConcepts: string[];
    offSecModules: string[];
    confidence: number;
    practicalTip?: string;
    labs?: Array<{ name: string; url: string; platform: string; level: string }>;
    courses?: Array<{ name: string; url: string; platform: string; certification?: string; free?: boolean }>;
}

// ─── Prompts ─────────────────────────────────────────────────────────

export interface PromptOutput {
    prompt: string;
    systemMessage: string;
    temperature: number;
    maxTokens: number;
}

// ─── LLM Parse Results ───────────────────────────────────────────────

export interface ParsedRAGResponse {
    answer: string;
    suggestedFollowups: string[];
    keyTakeaways: string[];
    relatedTopics?: RelatedTopic[];
    learningPath?: string;
}

export interface RelatedTopic {
    name: string;
    relationship: string;
    category: 'offensive' | 'defensive' | 'foundational';
}

export interface ParsedExplainJSON {
    explanation: string;
    analogies?: string[];
    relatedConcepts?: string[];
    offSecModules?: string[];
    practicalTip?: string;
}

// ─── Discord Adapter ─────────────────────────────────────────────────

export interface DiscordReplyOptions {
    content?: string;
    embeds?: import('discord.js').EmbedBuilder[];
    components?: import('discord.js').ActionRowBuilder<import('discord.js').MessageActionRowComponentBuilder>[];
    ephemeral?: boolean;
}

// ─── User Preferences (from DB) ──────────────────────────────────────

export interface UserPreferences {
    level: Level;
    style: ExplanationStyle;
}

// ─── Embedding API ───────────────────────────────────────────────────

export interface EmbeddingResponse {
    embeddings: Array<{ values: number[] }>;
}
