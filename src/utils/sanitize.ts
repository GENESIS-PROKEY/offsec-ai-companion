// Input sanitization — XSS/injection protection beyond length checks

/**
 * Sanitize user input before passing to LLM or embedding in Discord embeds.
 * Strips XSS vectors, zero-width chars, ANSI codes, and excessive whitespace.
 */
export function sanitizeInput(text: string): string {
    let clean = text;

    // 1. Strip HTML/script tags (XSS prevention)
    clean = clean.replace(/<\/?[^>]+(>|$)/g, '');

    // 2. Remove ANSI escape codes (terminal injection)
    clean = clean.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
    clean = clean.replace(/\x1B\].*?\x07/g, '');

    // 3. Remove zero-width and invisible unicode characters
    clean = clean.replace(/[\u200B\u200C\u200D\uFEFF\u00AD\u2060\u2061\u2062\u2063\u2064\u180E]/g, '');

    // 4. Strip common control characters (except newline/tab)
    clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // 5. Collapse excessive newlines (max 2 consecutive)
    clean = clean.replace(/\n{3,}/g, '\n\n');

    // 6. Collapse excessive spaces (max 2 consecutive)
    clean = clean.replace(/ {3,}/g, '  ');

    // 7. Trim leading/trailing whitespace
    clean = clean.trim();

    return clean;
}
