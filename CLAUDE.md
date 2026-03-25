# Memory Bot — YouTube Channel AI Agents

## Project Overview

YouTube kanallari uchun shaxsiy AI agentlar platformasi. Har bir agent o'z kanaliga mos xarakter, bilim va xotiraga ega bo'ladi. LangChain.js + DeepSeek asosida qurilgan.

## Tech Stack

- **Runtime**: Bun (NOT Node.js)
- **Language**: TypeScript (strict mode)
- **AI Framework**: LangChain.js (`langchain`, `@langchain/core`, `@langchain/openai`)
- **Memory**: mem0 (`mem0ai/oss`) — persistent AI memory with pgvector backend
- **LLM**: DeepSeek via `@langchain/openai` (OpenAI-compatible API)
- **Embeddings**: OpenAI `text-embedding-3-small` (raw fetch + mem0)
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
│   ├── channel.routes.ts       # Channel endpoints
│   ├── transcript.routes.ts    # Transcript endpoints
│   ├── search.routes.ts        # Semantic search endpoints
│   └── chat.routes.ts          # AI chat endpoint
├── services/
│   ├── channel.service.ts      # Business logic (DB-first, yt-dlp fallback)
│   ├── channel.helpers.ts      # Channel resolution utilities
│   ├── transcript.service.ts   # Transcript fetch + summarize
│   ├── search.service.ts       # Vector search orchestration
│   └── chat.service.ts         # AI agent chat orchestration
├── agent/                      # LangChain ReAct agent
│   ├── create.ts               # Agent factory (per-channel, cached)
│   ├── tools.ts                # Agent tools (list_videos, get_transcript, semantic_search, get_channel_info)
│   └── prompt.ts               # System prompt builder (with mem0 context injection)
├── memory/                     # mem0 persistent memory layer
│   ├── config.ts               # mem0 configuration (DeepSeek LLM + pgvector)
│   └── client.ts               # Memory operations (save, recall, list)
├── ai/                         # Raw AI API calls (metadata, summarization)
│   ├── client.ts               # DeepSeek API client
│   ├── generate-metadata.ts    # AI channel metadata generation
│   └── summarize.ts            # Transcript summarization
├── vector/                     # Embeddings & semantic search
│   ├── embedder.ts             # OpenAI embeddings API
│   ├── chunker.ts              # Semantic text chunking
│   ├── ingest.ts               # Chunk → embed → store pipeline
│   └── store.ts                # pgvector storage & search
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
│   ├── response.ts             # { ok, data } / { ok, error } envelope
│   ├── request.ts              # Query param parsing
│   └── enums.ts                # Channel categories, languages
└── yt/                         # YouTube external service layer
    ├── types.ts
    ├── parse-channel.ts
    ├── fetch-videos.ts
    ├── fetch-transcript.ts
    └── fetch-channel-images.ts
```

## Layered Architecture

```
Routes → Services → Repositories → Database
                  → Agent module → LangChain (createAgent + tools)
                  → Memory module → mem0 (pgvector + DeepSeek)
                  → AI module   → DeepSeek API (metadata, summarization)
                  → YT module   → yt-dlp (external)
```

- **Routes**: HTTP concern only — parse request, delegate to service, format response
- **Services**: Business logic, validation, orchestration
- **Agent**: LangChain ReAct agent — per-channel, with tools for video/transcript/search access
- **Memory**: mem0 persistent memory — recalls past conversations, auto-extracts facts, deduplicates
- **AI**: Raw DeepSeek API calls for metadata generation and summarization
- **Repositories**: Data access — 1 file per DB table, raw SQL via Bun.sql
- **Vector**: OpenAI embeddings + pgvector for semantic search
- **YT module**: External service wrapper (yt-dlp subprocess)
- **Lib**: Shared infrastructure (errors, response helpers)

## Database

- PostgreSQL with `Bun.sql` (tagged template queries)
- Migrations: sequential `.sql` files in `src/db/migrations/`
- Schema per file: `001_create_enums.sql`, `002_create_channels.sql`, etc.
- Tables: `channels`, `videos`, `transcripts`, `channel_metadata`, `chunk_embeddings`
- mem0 manages its own tables: `agent_memories` (pgvector collection)
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

### mem0 Memory Layer
- Each channel = `agentId`, each user = `userId`
- Before agent response: `recallMemories()` retrieves relevant past context
- After agent response: `saveConversation()` persists new facts (non-blocking)
- mem0 auto-extracts facts, deduplicates, and manages memory lifecycle
- Memories injected into system prompt as additional context

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
GET  /api/channels/videos?channel=CalebWritesCode
GET  /api/channels/metadata?channel=CalebWritesCode
GET  /api/channels/metadata?channel=CalebWritesCode&version=2
GET  /api/channels/metadata/versions?channel=CalebWritesCode
GET  /api/transcripts?videoId=dQw4w9WgXcQ
POST /api/transcripts?videoId=dQw4w9WgXcQ
GET  /api/search?channel=CalebWritesCode&q=react hooks
POST /api/chat                    # AI agent chat
```

### POST /api/chat

```json
{
  "channel": "CalebWritesCode",
  "userId": "user-123",
  "message": "Bu kanalda React haqida qanday videolar bor?",
  "history": []
}
```

### GET /api/chat/memories

```
GET /api/chat/memories?channel=CalebWritesCode&userId=user-123
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
DEEPSEEK_API_KEY=            # Required for AI agent + metadata + summarization
OPENAI_API_KEY=              # Required for embeddings (text-embedding-3-small)
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
