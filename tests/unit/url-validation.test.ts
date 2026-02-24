import { describe, it, expect } from 'vitest';
import { ALL_LABS } from '../../src/data/labs.js';

// Load courses data
import { ALL_COURSES } from '../../src/data/courses.js';

describe('Lab URL Validation', () => {
    const PLATFORM_DOMAINS: Record<string, string[]> = {
        'PortSwigger': ['portswigger.net'],
        'TryHackMe': ['tryhackme.com'],
        'HackTheBox': ['hackthebox.com', 'app.hackthebox.com'],
        'OffSec': ['offsec.com', 'offensive-security.com'],
        'CyberDefenders': ['cyberdefenders.org'],
        'PentesterLab': ['pentesterlab.com'],
    };

    it('should have no duplicate URLs', () => {
        const urls = ALL_LABS.map(l => l.url);
        const dupes = urls.filter((u, i) => urls.indexOf(u) !== i);
        expect(dupes, `Duplicate URLs found: ${dupes.join(', ')}`).toHaveLength(0);
    });

    it('should have URLs matching their platform domain', () => {
        for (const lab of ALL_LABS) {
            const expectedDomains = PLATFORM_DOMAINS[lab.platform];
            if (!expectedDomains) continue; // Unknown platform, skip

            const urlObj = new URL(lab.url);
            const matchesDomain = expectedDomains.some(d => urlObj.hostname.includes(d));
            expect(matchesDomain, `${lab.name} (${lab.platform}) URL domain mismatch: ${lab.url}`)
                .toBe(true);
        }
    });

    it('should have no fabricated dvwa-prefixed URL slugs', () => {
        for (const lab of ALL_LABS) {
            if (lab.platform === 'TryHackMe') {
                const slug = lab.url.split('/').pop() ?? '';
                const isFake = slug.startsWith('dvwa') && slug !== 'dvwa';
                expect(isFake, `Fabricated slug found: ${slug} for ${lab.name}`)
                    .toBe(false);
            }
        }
    });

    it('should have all URLs as valid https URLs', () => {
        for (const lab of ALL_LABS) {
            expect(() => new URL(lab.url)).not.toThrow();
            expect(lab.url.startsWith('https://')).toBe(true);
        }
    });
});

describe('Course URL Validation', () => {
    it('should have no duplicate course URLs', () => {
        const urls = ALL_COURSES.map(c => c.url);
        const dupes = urls.filter((u, i) => urls.indexOf(u) !== i);
        expect(dupes, `Duplicate URLs found: ${dupes.join(', ')}`).toHaveLength(0);
    });

    it('should have all course URLs as valid https URLs', () => {
        for (const course of ALL_COURSES) {
            expect(() => new URL(course.url)).not.toThrow();
            expect(course.url.startsWith('https://')).toBe(true);
        }
    });
});
