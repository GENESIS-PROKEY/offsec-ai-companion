// Course lookup utility — finds relevant courses/certifications for a topic + level

import type { Level } from '../config/constants.js';
import { ALL_COURSES, type Course } from '../data/courses.js';

const MAX_RESULTS = 3;

/**
 * Find courses matching a topic at the given user level.
 * Returns up to 3 courses sorted by relevance.
 * Falls back to adjacent levels if no exact match.
 */
export function getCoursesForTopic(topic: string, level: Level): Course[] {
    const lower = topic.toLowerCase();
    const words = lower.split(/\s+/).filter(w => w.length > 2);

    // Score each course by match quality
    const scored = ALL_COURSES
        .filter(course => course.level === level)
        .map(course => {
            let score = 0;

            for (const t of course.topics) {
                if (lower.includes(t) || t.includes(lower)) score += 10;
            }

            for (const word of words) {
                for (const t of course.topics) {
                    if (t.includes(word)) score += 2;
                }
                if (course.name.toLowerCase().includes(word)) score += 3;
                if (course.certification?.toLowerCase().includes(word)) score += 5;
            }

            // Bonus for free courses (only as tiebreaker when there's a real match)
            if (course.free && score > 0) score += 1;

            return { course, score };
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RESULTS)
        .map(({ course }) => course);

    if (scored.length > 0) return scored;

    // Fallback to adjacent levels
    const LEVEL_PRIORITY: Record<Level, Level[]> = {
        expert: ['intermediate'],
        intermediate: ['expert', 'beginner'],
        beginner: ['intermediate'],
    };

    const fallbackLevels = LEVEL_PRIORITY[level];
    return ALL_COURSES
        .filter(course => fallbackLevels.includes(course.level))
        .map(course => {
            let score = 0;
            for (const t of course.topics) {
                if (lower.includes(t) || t.includes(lower)) score += 10;
            }
            for (const word of words) {
                for (const t of course.topics) {
                    if (t.includes(word)) score += 2;
                }
            }
            return { course, score };
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RESULTS)
        .map(({ course }) => course);
}

/** Format courses into a Discord-friendly string */
export function formatCoursesForEmbed(courses: Array<{ name: string; url: string; certification?: string; free?: boolean; duration?: string }>): string {
    if (courses.length === 0) return '';

    return courses.map(course => {
        const cert = course.certification ? ` (${course.certification})` : '';
        const free = course.free ? ' 🆓' : '';
        const duration = course.duration ? ` · ${course.duration}` : '';
        return `📚 [${course.name}](${course.url})${cert}${free}${duration}`;
    }).join('\n');
}
