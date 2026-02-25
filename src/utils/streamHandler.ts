/**
 * Stream Handler — buffers streamed LLM tokens and provides batched updates.
 *
 * Discord rate-limits message edits to ~5 per 5s, so we can't edit on every token.
 * This utility collects chunks and emits updates at configurable intervals.
 *
 * Usage:
 *   const handler = new StreamHandler(500); // batch every 500ms
 *   for await (const chunk of generateCompletionStream(...)) {
 *       handler.push(chunk);
 *       if (handler.shouldFlush()) {
 *           await message.edit({ embeds: [buildEmbed(handler.getText())] });
 *           handler.markFlushed();
 *       }
 *   }
 *   // Final update with complete text
 *   const finalText = handler.getText();
 */

export class StreamHandler {
    private buffer = '';
    private lastFlushTime = 0;
    private readonly intervalMs: number;

    constructor(intervalMs = 500) {
        this.intervalMs = intervalMs;
        this.lastFlushTime = Date.now();
    }

    /** Push a new chunk from the LLM stream */
    push(chunk: string): void {
        this.buffer += chunk;
    }

    /** Get the full accumulated text so far */
    getText(): string {
        return this.buffer;
    }

    /** Check if enough time has passed since the last flush to send an update */
    shouldFlush(): boolean {
        return Date.now() - this.lastFlushTime >= this.intervalMs;
    }

    /** Mark that a flush (message edit) just happened */
    markFlushed(): void {
        this.lastFlushTime = Date.now();
    }

    /** Get the total character count accumulated */
    get length(): number {
        return this.buffer.length;
    }

    /** Reset the handler for reuse */
    reset(): void {
        this.buffer = '';
        this.lastFlushTime = Date.now();
    }
}
