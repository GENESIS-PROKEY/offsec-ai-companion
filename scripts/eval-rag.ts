// RAG quality evaluation script
// Usage: npx tsx scripts/eval-rag.ts
// Evaluates RAG answer quality against test Q&As

import { logger } from '../src/utils/logger.js';

interface TestCase {
    question: string;
    expectedKeywords: string[];
    category: string;
    difficulty: 'easy' | 'medium' | 'hard';
}

const TEST_CASES: TestCase[] = [
    // === Fundamentals (Easy) ===
    { question: 'What is SQL injection?', expectedKeywords: ['inject', 'query', 'database', 'input'], category: 'web', difficulty: 'easy' },
    { question: 'What is XSS?', expectedKeywords: ['cross-site', 'script', 'browser', 'inject'], category: 'web', difficulty: 'easy' },
    { question: 'What is phishing?', expectedKeywords: ['social engineering', 'email', 'credential', 'trick'], category: 'social', difficulty: 'easy' },
    { question: 'What is a firewall?', expectedKeywords: ['network', 'traffic', 'filter', 'rule'], category: 'network', difficulty: 'easy' },
    { question: 'What is encryption?', expectedKeywords: ['cipher', 'key', 'plaintext', 'protect'], category: 'crypto', difficulty: 'easy' },
    { question: 'What is malware?', expectedKeywords: ['malicious', 'software', 'virus', 'trojan'], category: 'malware', difficulty: 'easy' },
    { question: 'What is a VPN?', expectedKeywords: ['tunnel', 'encrypt', 'private', 'network'], category: 'network', difficulty: 'easy' },
    { question: 'What is two-factor authentication?', expectedKeywords: ['factor', 'authentication', 'token', 'password'], category: 'auth', difficulty: 'easy' },
    { question: 'What is a brute force attack?', expectedKeywords: ['password', 'combination', 'guess', 'try'], category: 'attack', difficulty: 'easy' },
    { question: 'What is a DDoS attack?', expectedKeywords: ['distributed', 'deny', 'flood', 'traffic'], category: 'network', difficulty: 'easy' },

    // === Intermediate ===
    { question: 'How does Kerberos authentication work?', expectedKeywords: ['ticket', 'KDC', 'TGT', 'service'], category: 'auth', difficulty: 'medium' },
    { question: 'Explain CSRF attacks', expectedKeywords: ['cross-site', 'request', 'forgery', 'token'], category: 'web', difficulty: 'medium' },
    { question: 'What is privilege escalation?', expectedKeywords: ['privilege', 'root', 'admin', 'escalat'], category: 'attack', difficulty: 'medium' },
    { question: 'How does nmap work?', expectedKeywords: ['scan', 'port', 'host', 'discover'], category: 'tools', difficulty: 'medium' },
    { question: 'What is OWASP Top 10?', expectedKeywords: ['OWASP', 'vulnerability', 'risk', 'web'], category: 'web', difficulty: 'medium' },
    { question: 'Explain buffer overflow attacks', expectedKeywords: ['buffer', 'memory', 'stack', 'overflow'], category: 'binary', difficulty: 'medium' },
    { question: 'What is a reverse shell?', expectedKeywords: ['shell', 'connect', 'back', 'listen'], category: 'attack', difficulty: 'medium' },
    { question: 'How does ARP spoofing work?', expectedKeywords: ['ARP', 'MAC', 'network', 'spoof'], category: 'network', difficulty: 'medium' },
    { question: 'What is SSRF?', expectedKeywords: ['server-side', 'request', 'forgery', 'internal'], category: 'web', difficulty: 'medium' },
    { question: 'Explain the CIA triad', expectedKeywords: ['confidentiality', 'integrity', 'availability'], category: 'fundamentals', difficulty: 'medium' },

    // === Expert ===
    { question: 'What is a Return-Oriented Programming attack?', expectedKeywords: ['ROP', 'gadget', 'stack', 'chain'], category: 'binary', difficulty: 'hard' },
    { question: 'How does NTLM relay work?', expectedKeywords: ['NTLM', 'relay', 'hash', 'authentication'], category: 'windows', difficulty: 'hard' },
    { question: 'Explain Kerberoasting', expectedKeywords: ['kerberos', 'service', 'ticket', 'crack'], category: 'windows', difficulty: 'hard' },
    { question: 'What is IDOR?', expectedKeywords: ['insecure', 'direct', 'object', 'reference'], category: 'web', difficulty: 'hard' },
    { question: 'How does DNS tunneling work?', expectedKeywords: ['DNS', 'tunnel', 'exfiltrat', 'query'], category: 'network', difficulty: 'hard' },
    { question: 'What is an SMB relay attack?', expectedKeywords: ['SMB', 'relay', 'hash', 'NTLM'], category: 'windows', difficulty: 'hard' },
    { question: 'Explain race condition vulnerabilities', expectedKeywords: ['race', 'TOCTOU', 'concurrent', 'timing'], category: 'binary', difficulty: 'hard' },
    { question: 'What is a Golden Ticket attack?', expectedKeywords: ['krbtgt', 'ticket', 'domain', 'forge'], category: 'windows', difficulty: 'hard' },
    { question: 'How does format string exploitation work?', expectedKeywords: ['format', 'printf', '%', 'memory'], category: 'binary', difficulty: 'hard' },
    { question: 'Explain HTTP request smuggling', expectedKeywords: ['smuggl', 'Content-Length', 'Transfer-Encoding', 'desync'], category: 'web', difficulty: 'hard' },
];

interface EvalResult {
    question: string;
    category: string;
    difficulty: string;
    passed: boolean;
    keywordsFound: string[];
    keywordsMissed: string[];
    answerLength: number;
    hasFollowups: boolean;
    latencyMs: number;
}

async function evaluateQuestion(
    orchestrator: any,
    testCase: TestCase
): Promise<EvalResult> {
    const start = Date.now();

    try {
        const { result } = await orchestrator.handleAsk(
            'eval-system',
            'eval-bot',
            testCase.question
        );

        const answer = (result.answer ?? '').toLowerCase();
        const keywordsFound = testCase.expectedKeywords.filter(kw =>
            answer.includes(kw.toLowerCase())
        );
        const keywordsMissed = testCase.expectedKeywords.filter(kw =>
            !answer.includes(kw.toLowerCase())
        );

        // Pass if at least 50% of keywords are found
        const passed = keywordsFound.length >= testCase.expectedKeywords.length * 0.5;

        return {
            question: testCase.question,
            category: testCase.category,
            difficulty: testCase.difficulty,
            passed,
            keywordsFound,
            keywordsMissed,
            answerLength: answer.length,
            hasFollowups: (result.suggestedFollowups?.length ?? 0) > 0,
            latencyMs: Date.now() - start,
        };
    } catch (error: any) {
        return {
            question: testCase.question,
            category: testCase.category,
            difficulty: testCase.difficulty,
            passed: false,
            keywordsFound: [],
            keywordsMissed: testCase.expectedKeywords,
            answerLength: 0,
            hasFollowups: false,
            latencyMs: Date.now() - start,
        };
    }
}

async function main() {
    // Dynamic import to load config
    const { MCPOrchestrator } = await import('../src/mcp/orchestrator.js');
    const orchestrator = new MCPOrchestrator();

    const subset = process.argv.includes('--full') ? TEST_CASES : TEST_CASES.slice(0, 10);
    logger.info(`🧪 Running RAG evaluation on ${subset.length} / ${TEST_CASES.length} test cases...`);
    if (!process.argv.includes('--full')) {
        logger.info('   (use --full to run all 30 test cases)');
    }

    const results: EvalResult[] = [];

    for (let i = 0; i < subset.length; i++) {
        const tc = subset[i];
        logger.info(`[${i + 1}/${subset.length}] ${tc.question}`);

        const result = await evaluateQuestion(orchestrator, tc);
        results.push(result);

        const icon = result.passed ? '✅' : '❌';
        logger.info(`  ${icon} ${result.keywordsFound.length}/${tc.expectedKeywords.length} keywords | ${result.answerLength} chars | ${result.latencyMs}ms`);

        // Rate limit protection
        if (i < subset.length - 1) {
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    // ═══ Summary ═══
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const avgLatency = Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / total);
    const avgLength = Math.round(results.reduce((s, r) => s + r.answerLength, 0) / total);

    console.log('\n' + '═'.repeat(60));
    console.log('📊 RAG EVALUATION RESULTS');
    console.log('═'.repeat(60));
    console.log(`✅ Passed:          ${passed}/${total} (${Math.round(passed / total * 100)}%)`);
    console.log(`📏 Avg answer len:  ${avgLength} chars`);
    console.log(`⏱️  Avg latency:     ${avgLatency}ms`);
    console.log(`📝 With follow-ups: ${results.filter(r => r.hasFollowups).length}/${total}`);

    // By difficulty
    for (const diff of ['easy', 'medium', 'hard'] as const) {
        const subset = results.filter(r => r.difficulty === diff);
        if (subset.length === 0) continue;
        const p = subset.filter(r => r.passed).length;
        console.log(`\n  ${diff.toUpperCase()}: ${p}/${subset.length} passed`);
    }

    // By category
    const categories = [...new Set(results.map(r => r.category))];
    console.log('\nBy Category:');
    for (const cat of categories) {
        const subset = results.filter(r => r.category === cat);
        const p = subset.filter(r => r.passed).length;
        console.log(`  ${cat}: ${p}/${subset.length}`);
    }

    // Failed cases
    const failed = results.filter(r => !r.passed);
    if (failed.length > 0) {
        console.log(`\n❌ Failed (${failed.length}):`);
        for (const f of failed) {
            console.log(`  • ${f.question}`);
            console.log(`    Missing: ${f.keywordsMissed.join(', ')}`);
        }
    }

    console.log('\n' + '═'.repeat(60));
    process.exit(passed === total ? 0 : 1);
}

main().catch(err => {
    logger.fatal({ err }, 'Eval script crashed');
    process.exit(2);
});
