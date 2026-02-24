// Curated cybersecurity labs database — loads from data/labs.json
// Covers: PortSwigger Web Security Academy, TryHackMe, HackTheBox, OffSec
// ~140 labs across ALL major cybersecurity topics
//
// To add new labs: edit data/labs.json (no TypeScript knowledge required)

import type { Level } from '../config/constants.js';
import { createRequire } from 'module';

export interface Lab {
    /** Human-readable lab/room/machine name */
    name: string;
    /** Working URL to the lab page */
    url: string;
    /** Platform name */
    platform: 'PortSwigger' | 'TryHackMe' | 'HackTheBox' | 'OffSec' | 'CyberDefenders' | 'PentesterLab';
    /** Difficulty level */
    level: Level;
    /** Topic keywords for matching (lowercase) */
    topics: string[];
}

// Load labs from JSON file — no hardcoded data in TypeScript
const require = createRequire(import.meta.url);
const labsData: Lab[] = require('../../data/labs.json');

export const ALL_LABS: Lab[] = labsData;
