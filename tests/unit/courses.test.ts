import { describe, it, expect } from 'vitest';
import { getCoursesForTopic, formatCoursesForEmbed } from '../../src/utils/courses.js';
import { ALL_COURSES } from '../../src/data/courses.js';

describe('Course Data Validation', () => {
    it('should have 45+ courses', () => {
        expect(ALL_COURSES.length).toBeGreaterThanOrEqual(45);
    });

    it('should have valid URLs (https://)', () => {
        for (const course of ALL_COURSES) {
            expect(course.url, `${course.name} has invalid URL`).toMatch(/^https:\/\//);
        }
    });

    it('should have valid level values', () => {
        const validLevels = ['beginner', 'intermediate', 'expert'];
        for (const course of ALL_COURSES) {
            expect(validLevels).toContain(course.level);
        }
    });

    it('should have at least one topic per course', () => {
        for (const course of ALL_COURSES) {
            expect(course.topics.length, `${course.name} has no topics`).toBeGreaterThanOrEqual(1);
        }
    });

    it('should include major certifications', () => {
        const certs = ALL_COURSES.map(c => c.certification).filter(Boolean);
        expect(certs).toContain('OSCP');
        expect(certs).toContain('eJPT');
        expect(certs).toContain('Security+');
    });

    it('should include free courses', () => {
        const freeCourses = ALL_COURSES.filter(c => c.free);
        expect(freeCourses.length).toBeGreaterThanOrEqual(2);
    });
});

describe('getCoursesForTopic', () => {
    it('should return courses matching a topic', () => {
        const courses = getCoursesForTopic('penetration testing', 'intermediate');
        expect(courses.length).toBeGreaterThan(0);
        expect(courses.length).toBeLessThanOrEqual(3);
    });

    it('should return courses matching certifications', () => {
        const courses = getCoursesForTopic('oscp', 'intermediate');
        expect(courses.length).toBeGreaterThan(0);
    });

    it('should return at most 3 results', () => {
        const courses = getCoursesForTopic('web security', 'beginner');
        expect(courses.length).toBeLessThanOrEqual(3);
    });
});

describe('formatCoursesForEmbed', () => {
    it('should format courses with emoji', () => {
        const result = formatCoursesForEmbed([{
            name: 'Test Course',
            url: 'https://example.com',
            platform: 'TestPlatform',
            level: 'beginner' as const,
            topics: ['test'],
            free: true,
        }]);
        expect(result).toContain('📚');
        expect(result).toContain('[Test Course]');
        expect(result).toContain('🆓');
    });

    it('should return empty string for empty array', () => {
        expect(formatCoursesForEmbed([])).toBe('');
    });
});
