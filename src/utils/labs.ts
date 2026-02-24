// Lab lookup utility — finds relevant labs for a topic + level

import type { Level } from '../config/constants.js';
import { ALL_LABS, type Lab } from '../data/labs.js';

const MAX_RESULTS = 5;

/**
 * Find labs matching a topic at the given user level.
 * Returns up to 5 labs sorted by relevance (exact match > partial match).
 * Falls back to broader matches if no exact-topic labs exist at the requested level.
 */
export function getLabsForTopic(topic: string, level: Level): Lab[] {
    const lower = topic.toLowerCase();
    const words = lower.split(/\s+/).filter(w => w.length > 2);
    const MIN_SCORE = 3; // Require meaningful match, not just partial word overlap

    // Score each lab by how well it matches
    const scored = ALL_LABS
        .filter(lab => lab.level === level)
        .map(lab => {
            let score = 0;

            // Exact topic match — highest priority
            for (const t of lab.topics) {
                if (lower.includes(t) || t.includes(lower)) {
                    score += 10;
                }
            }

            // Word-level matches
            for (const word of words) {
                for (const t of lab.topics) {
                    if (t.includes(word)) score += 2;
                }
                if (lab.name.toLowerCase().includes(word)) score += 1;
            }

            return { lab, score };
        })
        .filter(({ score }) => score >= MIN_SCORE)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RESULTS)
        .map(({ lab }) => lab);

    // If we got results at the exact level, return them
    if (scored.length > 0) return scored;

    // Fallback: try adjacent levels (expert→intermediate, beginner→intermediate)
    // NEVER show beginner-level labs to expert users
    const LEVEL_PRIORITY: Record<Level, Level[]> = {
        expert: ['intermediate'],           // expert falls back to intermediate only
        intermediate: ['expert', 'beginner'], // intermediate can go either way
        beginner: ['intermediate'],          // beginner falls back to intermediate only
    };

    const fallbackLevels = LEVEL_PRIORITY[level];
    const fallback = ALL_LABS
        .filter(lab => fallbackLevels.includes(lab.level))
        .map(lab => {
            let score = 0;
            for (const t of lab.topics) {
                if (lower.includes(t) || t.includes(lower)) score += 10;
            }
            for (const word of words) {
                for (const t of lab.topics) {
                    if (t.includes(word)) score += 2;
                }
            }
            // Prioritize harder labs first in fallback
            if (lab.level === 'expert') score += 3;
            else if (lab.level === 'intermediate') score += 1;
            return { lab, score };
        })
        .filter(({ score }) => score >= MIN_SCORE)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RESULTS)
        .map(({ lab }) => lab);

    return fallback;
}

/** Format labs into a Discord-friendly string with clickable links */
export function formatLabsForEmbed(labs: Array<{ name: string; url: string; platform: string; level: string }>): string {
    if (labs.length === 0) return '';

    const PLATFORM_EMOJI: Record<string, string> = {
        'PortSwigger': '🌐',
        'TryHackMe': '🎯',
        'HackTheBox': '📦',
        'OffSec': '🎓',
        'CyberDefenders': '🛡️',
        'PentesterLab': '🔬',
    };

    const LEVEL_BADGE: Record<string, string> = {
        'beginner': '🟢',
        'intermediate': '🟡',
        'expert': '🔴',
    };

    return labs.map(lab => {
        const emoji = PLATFORM_EMOJI[lab.platform] ?? '🔗';
        const badge = LEVEL_BADGE[lab.level] ?? '';
        return `${emoji} [${lab.name}](${lab.url}) ${badge}`;
    }).join('\n');
}
