# 📚 Knowledge Ingestion Guide

Feed your OffSec AI Companion with cybersecurity knowledge. The more you ingest, the smarter and more accurate the bot becomes.

---

## 🗂️ How It Works

```
data/knowledge/
├── glossary/       → Cybersecurity terms & definitions
├── owasp/          → OWASP Top 10, guides, cheat sheets
├── kali/           → Kali Linux tools & usage guides
└── offsec-modules/ → Course content, lab notes, walkthroughs
```

The ingestion script reads files from these directories, splits them into chunks, generates embeddings via Gemini, and stores them in **ChromaDB** for retrieval-augmented generation (RAG).

---

## 📝 Supported Formats

| Format | Best For |
|--------|----------|
| `.md`  | Tutorials, walkthrough guides, concept explanations |
| `.txt` | Raw notes, tool outputs, command references |
| `.json`| Structured data (glossary entries, tool databases) |

---

## 🚀 Step-by-Step Instructions

### 1. Add Knowledge Files

Drop your files into the appropriate `data/knowledge/` subdirectory:

```bash
# Examples
data/knowledge/glossary/sql-injection.md
data/knowledge/owasp/a01-broken-access-control.md
data/knowledge/kali/nmap-cheatsheet.md
data/knowledge/offsec-modules/oscp-privesc-guide.md
```

### 2. Make Sure Docker & ChromaDB Are Running

```bash
docker-compose up -d
```

Verify ChromaDB is accessible:
```bash
curl http://localhost:8000/api/v1/heartbeat
# Should return: {"nanosecond heartbeat": ...}
```

### 3. Run the Ingestion Script

```bash
npx tsx scripts/ingest.ts
```

You'll see output like:
```
🔄 Starting knowledge ingestion...
Processing source directory — dir: "glossary", files: 1
File ingested — file: "core-concepts.md", chunks: 8
Processing source directory — dir: "owasp", files: 1
File ingested — file: "top10-2021.md", chunks: 6
✅ Ingestion complete — totalDocs: 2, totalChunks: 14, totalErrors: 0
```

### 4. Verify in ChromaDB

```bash
curl http://localhost:8000/api/v1/collections
```

You should see `offsec_knowledge` collection with document count > 0.

---

## ✍️ Writing Good Knowledge Files

### Markdown Template

```markdown
# Topic Title

## Overview
Brief introduction to the concept.

## How It Works
Detailed technical explanation with steps.

## Attack Techniques
- Technique 1: description
- Technique 2: description

## Defense & Mitigation
- Countermeasure 1
- Countermeasure 2

## Tools
- `tool_name` — what it does
- `tool_name` — what it does

## References
- [OWASP](https://owasp.org)
- [MITRE ATT&CK](https://attack.mitre.org)
```

### Tips for Best RAG Results

1. **Use clear headings** — H2 headers help the chunker split content meaningfully
2. **Be specific** — "SQL injection in PHP with PDO" > "SQL injection"
3. **Include examples** — Code snippets, commands, payloads improve answer quality
4. **Add context** — Mention related tools, CVEs, and MITRE ATT&CK IDs
5. **Keep files focused** — One concept per file works better than mega-documents

---

## 📁 Adding New Source Categories

Edit `scripts/ingest.ts` and add a new entry to the `SOURCES` array:

```typescript
const SOURCES: SourceConfig[] = [
    { dir: 'glossary', category: 'glossary', extensions: ['.md', '.txt', '.json'] },
    { dir: 'owasp', category: 'owasp', extensions: ['.md', '.txt'] },
    { dir: 'kali', category: 'tools', extensions: ['.md', '.txt'] },
    { dir: 'offsec-modules', category: 'courses', extensions: ['.md', '.txt', '.json'] },
    // Add your own:
    { dir: 'hackthebox', category: 'ctf', extensions: ['.md'] },
    { dir: 'cve-database', category: 'vulnerabilities', extensions: ['.md', '.json'] },
];
```

Then create the directory: `data/knowledge/hackthebox/`

---

## ⚡ Quick Reference

| Action | Command |
|--------|---------|
| Start ChromaDB | `docker-compose up -d` |
| Ingest all knowledge | `npx tsx scripts/ingest.ts` |
| Check ChromaDB status | `curl http://localhost:8000/api/v1/heartbeat` |
| List collections | `curl http://localhost:8000/api/v1/collections` |
| Start bot | `npm run dev` |
