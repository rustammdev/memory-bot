# Memory Bot — YouTube Channel AI Agents

## Project Overview

YouTube kanallari uchun shaxsiy AI agentlar platformasi. Har bir agent o'z kanaliga mos xarakter, bilim va xotiraga ega bo'ladi. LangChain + Anthropic Claude asosida qurilgan.

## Tech Stack

- **Runtime**: Bun (NOT Node.js)
- **Language**: TypeScript (strict mode)
- **AI Framework**: LangChain.js (`langchain`, `@langchain/core`, `@langchain/anthropic`)
- **LLM**: Claude (Anthropic) via `@langchain/anthropic`
- **Database**: PostgreSQL via `Bun.sql` (NOT SQLite, NOT pg, NOT postgres.js)
- **Server**: `Bun.serve()` (NOT express)
- **Testing**: `bun test`

## Architecture

```
src/
├── index.ts                    # Entry — migrations + server start
├── server.ts                   # Bun.serve konfiguratsiyasi
├── routes/
│   ├── index.ts                # Route registry
│   └── channel.routes.ts       # Channel endpoints
├── services/
│   └── channel.service.ts      # Business logic (DB-first, yt-dlp fallback)
├── repositories/               # Data access layer (1 file per table)
│   ├── channel.repo.ts
│   ├── video.repo.ts
│   ├── transcript.repo.ts
│   └── metadata.repo.ts
├── db/
│   ├── connection.ts           # Bun.sql PostgreSQL connection
│   ├── migrate.ts              # Auto migration runner
│   └── migrations/             # Sequential .sql files (001_, 002_...)
├── lib/
│   ├── errors.ts               # AppError hierarchy
│   └── response.ts             # { ok, data } / { ok, error } envelope
└── yt/                         # YouTube external service layer
    ├── types.ts
    ├── parse-channel.ts
    └── fetch-videos.ts
```

## Layered Architecture

```
Routes → Services → Repositories → Database
                  → YT module    → yt-dlp (external)
```

- **Routes**: HTTP concern only — parse request, delegate to service, format response
- **Services**: Business logic, validation, orchestration
- **Repositories**: Data access — 1 file per DB table, raw SQL via Bun.sql
- **YT module**: External service wrapper (yt-dlp subprocess)
- **Lib**: Shared infrastructure (errors, response helpers)

## Database

- PostgreSQL with `Bun.sql` (tagged template queries)
- Migrations: sequential `.sql` files in `src/db/migrations/`
- Schema per file: `001_create_enums.sql`, `002_create_channels.sql`, etc.
- Tables: `channels`, `videos`, `transcripts`, `channel_metadata`
- Metadata is versioned — latest returned by default, old via separate API

## Key Concepts

### DB-First Strategy
1. Search PostgreSQL first
2. If not found → fetch from yt-dlp → save to DB → return
3. Metadata generated only after first transcript exists

### Versioned Metadata
- Each channel_metadata row has a `version` (auto-increment per channel)
- Default API returns latest version
- Separate endpoint for version history

### Immutability
- NEVER mutate objects — always create new copies
- Use `Readonly<T>` and `ReadonlyArray<T>` for type safety

## Commands

```bash
bun run start               # Start server (runs migrations first)
bun run dev                 # Watch mode
bun run migrate             # Run migrations only
bun test                    # Run all tests
bun test --watch            # Watch mode
```

## API Endpoints

```
GET /api/channels/videos?channel=CalebWritesCode
GET /api/channels/metadata?channel=CalebWritesCode
GET /api/channels/metadata?channel=CalebWritesCode&version=2
GET /api/channels/metadata/versions?channel=CalebWritesCode
```

## Bun-Specific Rules

- Use `Bun.sql` for PostgreSQL (NOT pg, NOT postgres.js)
- Use `Bun.serve()` for HTTP (NOT express)
- Use `Bun.file()` for file I/O (NOT node:fs readFile/writeFile)
- Use `Bun.spawn()` for subprocesses
- Bun auto-loads `.env` — do NOT use dotenv

## Environment Variables

```
DATABASE_URL=postgres://user:pass@localhost:5432/memory_bot
ANTHROPIC_API_KEY=           # Required for AI agents
LOG_LEVEL=info               # debug | info | warn | error
```

## Coding Standards

- **File size**: 200-400 lines typical, 800 max
- **Function size**: <50 lines
- **Nesting**: max 4 levels deep
- **Naming**: camelCase for variables/functions, PascalCase for types/classes
- **Exports**: Named exports only (NO default exports)
- **Errors**: Always handle explicitly, never swallow silently
- **Validation**: Validate all external input at boundaries

## Testing

- Minimum 80% coverage
- TDD workflow: RED → GREEN → REFACTOR
- Test files: `*.test.ts` next to source files
- Use `bun:test` (NOT jest, vitest)

## Git

- Commits in English: `type(scope): description`
- Branch naming: `feat/`, `fix/`, `refactor/`
- PR titles in English with full description
