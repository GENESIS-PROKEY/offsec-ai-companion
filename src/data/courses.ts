// Curated cybersecurity courses database — loads from data/courses.json
// Covers: OffSec, TCM Security, TryHackMe, HackTheBox, INE, CompTIA, SANS, EC-Council
// ~50 courses across all major certifications and learning paths
//
// To add new courses: edit data/courses.json (no TypeScript knowledge required)

import type { Level } from '../config/constants.js';
import { createRequire } from 'module';

export interface Course {
    /** Course title */
    name: string;
    /** Working URL to the course page */
    url: string;
    /** Platform / provider name */
    platform: string;
    /** Associated certification, if any */
    certification?: string;
    /** Difficulty level */
    level: Level;
    /** Topic keywords for matching (lowercase) */
    topics: string[];
    /** Estimated duration */
    duration?: string;
    /** Whether the course is free */
    free: boolean;
}

// Load courses from JSON file
const require = createRequire(import.meta.url);
const coursesData: Course[] = require('../../data/courses.json');

export const ALL_COURSES: Course[] = coursesData;
