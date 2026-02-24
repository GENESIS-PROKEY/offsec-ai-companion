# 🧠 OffSec AI Learning Companion

An AI-powered cybersecurity educator built for the OffSec Discord community.  
Not a wrapper around ChatGPT. Designed specifically for the OffSec Discord learning workflow — a full **Retrieval-Augmented Generation (RAG)** system with a modular **Model Context Protocol (MCP)** architecture, 6-tier LLM failover, vector search, adaptive skill-level personalization, and 216 curated hands-on labs mapped to topics.

> Built to teach, not to parrot. Every answer is grounded, cited, and level-appropriate.

---

## 🚀 Overview

The OffSec community is full of learners at wildly different stages — from "what is a port?" to "show me the heap corruption in CVE-2021-44228." Generic chatbots fail both audiences. They're either too shallow for experts or too technical for newcomers.

This bot solves that by combining:

- **Retrieval-Augmented Generation** — answers grounded in ingested cybersecurity documentation, not hallucinated
- **Adaptive skill levels** — the same topic explained three completely different ways depending on whether you're 🌱 beginner, ⚡ intermediate, or 🔬 expert
- **Structured responses** — every answer follows a consistent 8-section format (Overview, How It Works, Attack, Defense, Real-World Examples, Tools, Takeaways, References)
- **Hands-on lab recommendations** — 216 curated labs across PortSwigger, TryHackMe, HackTheBox, OffSec, CyberDefenders, and PentesterLab, matched to the topic automatically
- **Course recommendations** — 50 curated courses from 12 providers, matched and surfaced alongside answers

---

## 🎯 Who It Helps

| Audience | How the Bot Adapts |
|----------|-------------------|
| **Complete beginners** | ELI5 analogies ("SQL injection is like rewriting a restaurant order slip"), no jargon, 🎯 Beginner Tips section |
| **Intermediate practitioners** | Actual command syntax (`sqlmap -u`, `nmap -sV`), MITRE ATT&CK technique IDs, tool recommendations |
| **Expert / OSCP students** | CVE deep-dives, PoC code snippets, Sigma/YARA rules, protocol internals at memory/byte level, evasion-vs-detection analysis |
| **Discord study groups** | Multi-question quizzes on any topic, follow-up suggestions, learning path generation |
| **OffSec certification preppers** | PEN-200/OSCP-relevant labs surfaced automatically, structured study paths |

---

## 🏗️ Architecture

The bot is built on a **Model Context Protocol (MCP)** architecture — each capability is an independent, testable module with a consistent interface.

```
Discord Message
       ↓
┌─────────────────────────────────────────────────────────────┐
│                    MCP Orchestrator                          │
│   Routes commands, manages flow, enforces error boundaries  │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│ Explain  │   RAG    │  Memory  │  Pref    │     Prompt      │
│   MCP    │   MCP    │   MCP    │   MCP    │      MCP        │
│          │          │          │          │                 │
│ Level-   │ Embed →  │ SQLite   │ Adaptive │ Level-specific  │
│ adaptive │ Search → │ History  │ Level    │ Templates +     │
│ explain  │ Rerank → │ + Auto-  │ Detection│ Safety Rules    │
│ + labs   │ Generate │ Summary  │ + Streak │                 │
│ + courses│ + Cite   │          │ Tracking │                 │
└──────────┴──────────┴──────────┴──────────┴─────────────────┘
       ↓              ↓              ↓
┌──────────┐   ┌──────────┐   ┌──────────┐
│  Gemini  │   │ ChromaDB │   │  SQLite  │
│ 6-Tier   │   │ Vector   │   │  User    │
│ Fallback │   │  Store   │   │  Data    │
└──────────┘   └──────────┘   └──────────┘
```

### Module Breakdown

| Module | Responsibility | Key Implementation Detail |
|--------|---------------|--------------------------|
| **Orchestrator** | Route commands, manage 5-step flows | Coordinates Preference → Memory → Prompt → MCP → Store for every request |
| **ExplainMCP** | Generate level-appropriate explanations | Returns structured JSON with 8 sections, enriches with labs + courses |
| **RAGMCP** | Retrieval-augmented Q&A | Full pipeline: embed query → ChromaDB search → similarity filter → rerank → LLM generate with context injection → cite sources |
| **MemoryMCP** | Per-user interaction history | SQLite-backed, auto-summarizes learning journey every 20 interactions via LLM |
| **PreferenceMCP** | User profile & adaptive level detection | Analyzes vocabulary patterns ("what is" = beginner, "edge case" = expert), streak tracking |
| **PromptMCP** | Centralized prompt engineering | Three entirely different prompt templates per level, with safety guardrails appended |

### 6-Tier AI Fallback Chain

The AI service doesn't depend on a single API key or model. It runs a **priority-ordered chain** of 6 Gemini providers:

```
Gemini 3 Flash → Gemini 2.5 Flash → Gemini 2.5 Flash Lite (×4 keys)
```

| Resilience Feature | Implementation |
|-------------------|----------------|
| **Rate-limit detection** | 429/402 → 30s cooldown per provider, auto-switch to next |
| **Connection recovery** | ECONNRESET, ETIMEDOUT, socket hang up → skip to next (no cooldown) |
| **Request timeout** | 30s hard limit prevents 5+ minute hangs |
| **Concurrency control** | Semaphore-based queue (max 2 parallel LLM calls) prevents rate-limit storms |
| **Model not found** | 404 → provider permanently disabled for session |
| **All providers down** | Uses soonest-to-recover provider, returns graceful error |
| **Empty responses** | Detected and retried on next provider |
| **Truncation detection** | `finish_reason: 'length'` logged with token usage stats |

---

## 🔍 How AI Is Used

This is **not a ChatGPT wrapper**. Here's exactly what the AI does and how:

### Retrieval-Augmented Generation (RAG)

```
User Question → Embed (Gemini Embedding API) → ChromaDB Vector Search
    → Similarity Filter (≥0.3) → Top-K Rerank → Context Injection
    → LLM Generation (with [N] inline citations) → Lab/Course Enrichment
```

1. **Embedding**: User's question is converted to a 384-dimensional vector using `gemini-embedding-001`
2. **Vector Search**: ChromaDB returns the top-K most similar document chunks from ingested cybersecurity knowledge
3. **Similarity Scoring**: Each chunk gets a similarity score (`1 - distance`). Chunks below 0.3 are discarded
4. **Reranking**: Surviving chunks are sorted by relevance, top 5 selected
5. **Context Injection**: Selected chunks are formatted with source IDs and injected into the LLM prompt
6. **Cited Generation**: LLM generates an answer using `[1]`, `[2]` inline citations referencing the context
7. **Fallback**: If ChromaDB returns zero results or is unreachable, the system falls back to LLM-only mode using direct knowledge

### Confidence Scoring

Confidence isn't a guess — it's **calculated from vector similarity metrics**:

```typescript
const avgSimilarity = relevantChunks.reduce((sum, c) => sum + c.similarity, 0) / relevantChunks.length;
this.lastConfidence = Math.min(avgSimilarity + 0.1, 1.0);
```

| Confidence | Meaning | Visual |
|-----------|---------|--------|
| **≥ 0.6** | High — answer is well-grounded in retrieved context | 🟢 |
| **0.3–0.6** | Medium — partial context, supplemented with LLM knowledge | 🟡 |
| **< 0.3** | Low — mostly LLM-generated, should verify independently | 🔴 |

This confidence score is shown to users on every response, building trust and transparency.

### Adaptive Personalization

The bot doesn't just store your level — it **detects** it:

```typescript
// Analyzes last 5 queries for vocabulary patterns
const expertPatterns = ['edge case', 'implementation', 'protocol', 'exploit', 'shellcode'];
const beginnerPatterns = ['what is', 'how does', 'explain', 'basic'];
```

Based on detection, it adjusts:
- **Temperature**: 0.8 for beginners (more creative analogies), 0.6 for experts (more precise)
- **Token limit**: 1x for beginner, 2x for intermediate, **6x for expert** (room for CVEs, PoC code, protocol internals)
- **Prompt structure**: Completely different prompts per level — not just a tone change

### Strict Output Enforcement

- JSON schema enforcement on every LLM response
- Code-fence stripping for LLM responses wrapped in ` ```json `
- Structured fallback when LLM produces invalid output
- Safety guardrails appended to every system prompt

---

## 🧠 Features

### `/explain <concept>`
Level-appropriate explanations with 8 structured sections, enriched with labs + courses.

- 🌱 **Beginner**: Everyday analogies, zero jargon, "Think of it like..." sections
- ⚡ **Intermediate**: Command syntax, MITRE ATT&CK IDs, tool recommendations
- 🔬 **Expert**: CVE analysis, PoC code, Sigma/YARA rules, protocol internals

### `/ask <question>`
RAG-powered Q&A with `[1]` inline citations, confidence scoring, and structured sections (📖 Overview → 🔍 Mechanism → ⚔️ Attack & Defense → 🔧 Tools → 🎓 Practice). Labs and courses appended automatically.

### `/quiz <topic>`
AI-generated quizzes with diversity enforcement — each question covers a different sub-topic, previous questions tracked to prevent repetition, difficulty matched to user level.

### `/related <concept>`
Knowledge graph exploration — related topics (⚔️ offensive, 🛡️ defensive, 📖 foundational), learning paths, attack chains.

### `/setlevel` · `/history`
Set your skill level or view your learning journey with auto-generated summaries.

---

## 📊 Confidence System

Every `/ask` response includes a confidence indicator calculated from **real similarity metrics**, not arbitrary numbers:

1. Retrieved chunks are scored: `similarity = 1 - cosine_distance`
2. Chunks below 0.3 similarity are filtered out
3. Average similarity of remaining chunks + 0.1 boost = final confidence
4. Displayed to user with color-coded emoji

**Why this matters**: Users can tell when the bot is confident vs. uncertain. Low-confidence answers include a note to verify independently. This prevents blind trust in AI-generated security advice — critical when the topic is cybersecurity.

When retrieval fails, the system lowers confidence and explicitly indicates reduced grounding — users always know when a response is less well-sourced.

---

## 🛡️ Responsible AI Design

Every response is governed by safety guardrails enforced at the prompt level:

1. **No unauthorized hacking**: Instructions for unauthorized access are never provided. Offensive techniques are framed as "how defenders detect this"
2. **Ethical framing**: All attack techniques reference authorized testing environments (HackTheBox, TryHackMe, OffSec labs)
3. **Grounded responses**: RAG pipeline grounds answers in ingested documentation, reducing hallucination
4. **Citation enforcement**: Sources cited inline so users can verify claims
5. **Refusal when insufficient context**: Low-confidence responses explicitly state uncertainty
6. **Responsible disclosure**: Discussions of vulnerabilities emphasize coordinated disclosure

```
SAFETY RULES (applied to every response):
1. NEVER provide step-by-step instructions for unauthorized network penetration
2. ALWAYS emphasize legal permissions, authorized testing, and responsible disclosure
3. When discussing offensive techniques, frame as "how defenders detect this"
4. Redirect unauthorized activity requests to legal alternatives
5. Include disclaimers when discussing powerful techniques
```

---

## 💡 Why This Project Stands Out

| Dimension | Generic Chatbot | GPT Wrapper | This Project |
|-----------|----------------|-------------|-------------|
| **Architecture** | Monolith | Single API call | Modular MCP with 5 specialized pipelines |
| **Grounding** | None | Prompt injection | Full RAG with vector search + citations |
| **Reliability** | Single point of failure | One API key | 6-tier fallback chain with rate-limit recovery |
| **Personalization** | None | Basic prompt prefix | Adaptive level detection + per-user memory |
| **Lab recommendations** | None | Hallucinated URLs | 216 verified labs across 6 platforms |
| **Confidence** | "I think..." | None | Calculated from vector similarity metrics |
| **Concurrency** | Unlimited (crash) | Unlimited (rate limited) | Semaphore queue (max 2) prevents storms |
| **Monitoring** | None | None | HTTP health endpoint with memory/error/queue stats |
| **Type safety** | JavaScript | JavaScript | TypeScript strict mode, 0 `any` types |
| **Tests** | None | None | 21 test files — unit, integration, pipeline |

---

## 🧪 Example Usage

### `/explain sql injection` (Beginner)
```
🌱 SQL Injection — Beginner Explanation

📖 What Is It?
SQL injection is like sneaking extra instructions into a restaurant order.
Imagine you write "1 pizza" on an order slip, but someone changes it to
"1 pizza AND everything in the kitchen for free." That's what happens when
an attacker manipulates database queries through user input...

🔍 How Does It Work?
1. Application takes user input (e.g., a login form)
2. Input is placed directly into a SQL query without sanitization
3. Attacker crafts input containing SQL commands
4. Database executes the malicious commands as if they were legitimate...

🔬 Hands-On Labs:
🌐 SQL Injection (PortSwigger) 🟢
📦 SQL Injection Fundamentals (HackTheBox) 🟢

📚 Recommended Courses:
📚 Web Security Academy (PortSwigger) 🆓
📚 Practical Ethical Hacking (TCM Security) · 25 hours
```

### `/ask how to detect lateral movement` (Intermediate)
```
📖 Overview
Lateral movement detection combines network monitoring, endpoint telemetry,
and behavioral analysis...

🔍 How It Works
1. Monitor for abnormal SMB/WinRM/RDP connections [1]
2. Track authentication patterns across endpoints [2]
3. Correlate with MITRE ATT&CK T1021 (Remote Services)...

⚔️ Attack & Defense
• PSExec → Detect via Sysmon Event ID 1 + named pipe creation
• WMI lateral movement → Monitor WMI event subscriptions...

🔧 Tools
• `Velociraptor` — endpoint visibility + hunting
• `Sigma rules` — generic detection signatures...

Confidence: 🟢 0.82 | Sources: [1] OWASP, [2] MITRE ATT&CK

🔬 Hands-On Labs:
🎯 Active Directory Basics (TryHackMe) ⚡
📦 Dante (HackTheBox) ⚡

💡 Suggested follow-ups:
→ What are Pass-the-Hash attacks?
→ How does Kerberoasting work?
```

---

## 🛠️ Installation & Setup

### Prerequisites

- **Node.js 18+**
- **Discord bot token** — [Discord Developer Portal](https://discord.com/developers/applications)
- **Gemini API key** — [Google AI Studio](https://aistudio.google.com/apikey)
- **ChromaDB** (optional) — for RAG vector search. Falls back to LLM-only mode without it.

### Quick Start

```bash
# Clone and install
git clone <repo-url>
cd offsec-ai-companion
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys (see table below)

# Deploy slash commands to Discord
npm run deploy

# Start the bot (development with hot reload)
npm run dev

# Or production
npm run build && npm start
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | ✅ | Discord bot token |
| `DISCORD_CLIENT_ID` | ✅ | Discord application client ID |
| `GEMINI1_API_KEY` | ✅ | Primary Gemini API key (Gemini 3 Flash) |
| `GEMINI2_API_KEY` | | Gemini 2.5 Flash key (fallback tier 2) |
| `GEMINI3_API_KEY` | | Gemini 2.5 Flash Lite key (fallback tier 3) |
| `GEMINI4_API_KEY` | | Lite key D (fallback tier 4) |
| `GEMINI5_API_KEY` | | Lite key E (fallback tier 5) |
| `GEMINI6_API_KEY` | | Lite key F (fallback tier 6) |
| `EMBEDDING_API_KEY` | ✅ | Gemini embedding model key |
| `SQLITE_PATH` | | SQLite path (default: `./data/bot.db`) |
| `CHROMA_HOST` | | ChromaDB host (default: `localhost`) |
| `CHROMA_PORT` | | ChromaDB port (default: `8000`) |

### Data Ingestion (for RAG)

```bash
# Ingest cybersecurity documents into ChromaDB
npm run ingest

# Seed the database with initial data
npm run seed

# Run RAG evaluation
npm run eval
```

---

## 📂 Project Structure

```
src/
├── bot/                          # Discord layer
│   ├── client.ts                 # Bot startup, event routing
│   ├── commands/                 # Command handlers
│   │   ├── ask.ts                # /ask — RAG Q&A
│   │   ├── explain.ts            # /explain — level-adaptive
│   │   ├── quiz.ts               # /quiz — multi-question quizzes
│   │   ├── related.ts            # /related — knowledge graph
│   │   ├── history.ts            # /history — learning journey
│   │   └── setlevel.ts           # /setlevel — skill configuration
│   └── embeds/                   # Discord embed builders
│       ├── explain.ts            # Rich explain embeds with labs+courses
│       ├── error.ts              # Branded error embeds
│       └── thinking.ts           # "Processing..." embeds
├── mcp/                          # Model Context Protocol modules
│   ├── orchestrator.ts           # Central command router (5-step flows)
│   ├── base.ts                   # Abstract MCP base class
│   ├── explain/                  # Concept explanation pipeline
│   ├── rag/                      # Retrieval-augmented generation
│   ├── memory/                   # Per-user conversation history
│   ├── preference/               # Adaptive level detection
│   └── prompts/                  # Prompt template engine + safety rules
├── services/                     # Infrastructure services
│   ├── ai.ts                     # 6-tier Gemini fallback chain
│   ├── queue.ts                  # LLM concurrency semaphore
│   ├── cache.ts                  # TTL response cache
│   └── health.ts                 # HTTP health monitor (/health)
├── db/                           # Database layer
│   ├── sqlite.ts                 # sql.js wrapper (user data)
│   └── chroma.ts                 # ChromaDB client (vector search)
├── data/                         # Data loaders
│   ├── labs.ts                   # 216 labs from labs.json
│   └── courses.ts                # 50 courses from courses.json
├── utils/                        # Shared utilities
│   ├── formatters.ts             # LLM output parsing, sanitization
│   ├── labs.ts                   # Topic→lab matching (scored)
│   ├── courses.ts                # Topic→course matching
│   ├── errors.ts                 # Typed error hierarchy
│   └── logger.ts                 # Pino structured logging
└── types/                        # TypeScript interfaces

data/
├── labs.json                     # 216 verified hands-on labs
└── courses.json                  # 50 curated courses

tests/
├── unit/                         # 13 unit test files
└── integration/                  # 4 integration test files (incl. pipeline)
```

---

## 🔮 Future Improvements

- **Web dashboard** — browser-based analytics for server admins
- **Community-contributed knowledge** — let users submit corrections and new content via Discord
- **Additional RAG datasets** — OWASP, NIST, CIS Benchmarks, MITRE ATT&CK, OffSec course material
- **Model fine-tuning** — custom model trained on cybersecurity Q&A pairs
- **Spaced repetition** — track quiz performance against learning paths
- **Cross-server leaderboards** — competitive learning metrics

---

## 🧰 Tech Stack

| Technology | Purpose |
|------------|---------|
| TypeScript (strict, 0 `any`) | Language |
| Discord.js 14 | Bot framework |
| Gemini API (6 keys) | LLM completions + embeddings |
| ChromaDB | Vector database for RAG |
| sql.js | In-process SQLite (user data) |
| Zod | Runtime config validation |
| Vitest | Testing (21 test files) |
| Pino | Structured JSON logging |
| OpenAI SDK | Gemini API compatibility layer |

---

## ❤️ Community

If this bot would have helped you during your OSCP prep — or if it's helping you right now — react with `:this:` in the Discord showcase channel.

Built with 🧠 for every learner who's ever stared at a box and thought *"where do I even start?"*

*Stay sharp. Stay curious. Stay OffSec.*
