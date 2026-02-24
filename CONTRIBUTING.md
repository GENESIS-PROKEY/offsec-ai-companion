# Contributing to OffSec AI Learning Companion

Thanks for your interest in contributing! This guide covers the dev setup, coding standards, and PR workflow.

## Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 9
- **ChromaDB** (optional — bot works in LLM-only mode without it)
- A Discord bot token (see `.env.example`)

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/your-org/offsec-ai-companion.git
cd offsec-ai-companion

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your Discord token, LLM provider keys, etc.

# 4. Start ChromaDB (optional)
docker compose up -d chromadb

# 5. Build & run
npm run build
npm run dev
```

## Project Structure

```
src/
├── bot/              # Discord bot, commands, embeds
│   ├── commands/     # /ask, /explain, /quiz, /related, /setlevel, /history
│   └── embeds/       # Rich embed builders (explain, error, thinking)
├── config/           # Zod config schema, constants, level multipliers
├── data/             # Static data (labs registry)
├── db/               # SQLite (memory) + ChromaDB (vectors)
├── mcp/              # MCP orchestrator, explain, RAG, memory, prompts
├── services/         # AI provider fallback, health server
├── types/            # TypeScript interfaces
└── utils/            # Shared utilities (discord, labs, formatters, sanitize, etc.)
tests/
├── unit/             # Unit tests
└── integration/      # Integration + E2E tests
```

## Development

### Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npx vitest run        # One-shot (CI mode)
```

### Type Checking

```bash
npx tsc --noEmit      # Must return 0 errors
```

### Linting

```bash
npm run lint          # ESLint
```

## Coding Standards

### TypeScript

- **Strict mode** — `strict: true` in tsconfig
- **No `as any`** — Use proper type assertions (`as Level`, `as Record<string, string>`)
- **Type-safe Discord** — Use utilities from `utils/discord.ts` for channel operations
- **Centralized constants** — All magic numbers go in `config/constants.ts`

### File Organization

- One exported function/class per file when possible
- Group related utilities (e.g., `utils/labs.ts` bundles lookup + formatting)
- Imports use `.js` extensions (ESM)

### Error Handling

- Use `AppError`, `ValidationError`, `AIProviderError` from `utils/errors.ts`
- Always call `incrementErrorCount()` in catch blocks
- Build user-friendly error embeds with `buildErrorEmbed()`

### Testing

- Use `vitest` for all tests
- Mock external dependencies (Discord, AI providers, ChromaDB)
- Write tests alongside the code: `tests/unit/` for unit, `tests/integration/` for E2E
- Target 100% of exported functions

## Pull Request Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all checks pass:
   ```bash
   npx tsc --noEmit    # 0 errors
   npm run lint         # 0 warnings
   npm test             # 150+ tests pass
   ```
4. Open a PR against `main`
5. CI will automatically run lint → typecheck → test → build
6. Request review from a maintainer

## Adding New Labs

The labs registry lives in `src/data/labs.ts`. To add new labs:

1. Add entries to the appropriate platform array (e.g., `PORTSWIGGER_LABS`)
2. Include: `name`, `url`, `platform`, `level`, and `topics` (lowercase keywords)
3. Verify URLs are working before merging
4. Labs are matched to user queries via keyword overlap in `utils/labs.ts`

## Health Endpoint

The bot exposes a `/health` endpoint (default port 3001):

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "ok",
  "uptime": 12345,
  "memory": { "rss": 50, "heapUsed": 30, "heapTotal": 40 },
  "errors": 0
}
```

## License

See [LICENSE](LICENSE) for details.
