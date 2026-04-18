# Memory Bot

A backend platform that turns any YouTube channel into a conversational AI agent with long-term memory, semantic search, and data-driven content insights.

Each channel is modeled as an isolated agent with its own character, corpus, and persistent memory. Users can chat with the agent about the channel's videos, receive weekly trend digests, and surface content-gap recommendations derived from the channel's own embedding space.

## Highlights

- **Per-channel agents** — one LangChain ReAct agent per channel, created on demand and cached in memory.
- **Persistent memory** — mem0 over pgvector extracts facts from conversations, deduplicates them, and injects relevant context into every subsequent turn.
- **Semantic search** — transcripts are chunked, embedded with `text-embedding-3-small`, and stored in pgvector for retrieval.
- **Smart Digest** — weekly channel summary with view-velocity scoring, persona-aware narration, and trend comparison against the previous digest.
- **Content Gap Finder** — k-means clustering over the channel's embeddings, AI-driven topic extraction, and ranked gap recommendations against a niche reference set.
- **Versioned metadata** — channel metadata is append-only; the latest version is served by default and full history is available via a dedicated endpoint.
- **DB-first ingestion** — PostgreSQL is the source of truth; `yt-dlp` is invoked only to backfill missing data.

## Technology

| Layer | Choice |
| --- | --- |
| Runtime | Bun |
| Language | TypeScript (strict) |
| HTTP server | `Bun.serve()` |
| Database | PostgreSQL via `Bun.sql` |
| Vector store | pgvector |
| Agent framework | LangChain.js (ReAct) |
| LLM | DeepSeek (OpenAI-compatible API) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Memory | [mem0](https://github.com/mem0ai/mem0) |
| Ingestion | `yt-dlp` subprocess |
| Tests | `bun:test` |

## Architecture

```
Routes  →  Services  →  Repositories  →  PostgreSQL
                     →  Agent   → LangChain ReAct + tools
                     →  Memory  → mem0 (pgvector + DeepSeek)
                     →  Vector  → embeddings, chunking, k-means
                     →  AI      → DeepSeek (metadata, summarization, digest, gap analysis)
                     →  YT      → yt-dlp (external)
```

Responsibilities are separated by layer:

- **Routes** handle HTTP concerns only: parse input, delegate, serialize the response envelope.
- **Services** own business logic, validation, and orchestration across repositories and modules.
- **Repositories** provide data access, one file per table, using raw SQL with `Bun.sql`.
- **Agent** exposes a channel-scoped ReAct agent with tools: `list_videos`, `get_transcript`, `semantic_search`, `get_latest_digest`, `find_content_gaps`.
- **Memory** wraps mem0: `recallMemories()` runs before each turn; `saveConversation()` runs asynchronously afterwards.
- **Vector** handles chunking, embedding, pgvector storage, and cluster analysis.
- **AI** isolates direct LLM calls used outside the agent loop (metadata generation, summarization, digest, gap analysis).

## Getting Started

```bash
bun install
cp .env.example .env
bun run start        # applies migrations, then starts the HTTP server
```

### Environment

```env
DATABASE_URL=postgres://user:password@localhost:5432/memory_bot
DEEPSEEK_API_KEY=    # LLM, metadata, summarization, digest, gap analysis
OPENAI_API_KEY=      # embeddings (text-embedding-3-small)
LOG_LEVEL=info       # debug | info | warn | error
```

## API

```http
GET  /api/channels/videos?channel=:handle
GET  /api/channels/metadata?channel=:handle
GET  /api/channels/metadata/versions?channel=:handle
GET  /api/channels/content-gaps?channel=:handle
POST /api/channels/content-gaps?channel=:handle&force=true
GET  /api/channels/content-gaps/versions?channel=:handle

GET  /api/transcripts?videoId=:id
POST /api/transcripts?videoId=:id

GET  /api/search?channel=:handle&q=:query

POST /api/chat
GET  /api/chat/memories?channel=:handle&userId=:id

GET  /api/digests?channel=:handle
POST /api/digests
GET  /api/digests/history?channel=:handle
```

All responses follow a uniform envelope: `{ ok: true, data }` on success, `{ ok: false, error }` on failure.

### Chat request

```json
POST /api/chat
{
  "channel": "CalebWritesCode",
  "userId":  "user-123",
  "message": "What React videos does this channel have?",
  "history": []
}
```

## Scripts

```bash
bun run dev         # watch mode
bun run migrate     # apply migrations only
bun test            # run the test suite
```

## Engineering Notes

- **Immutability** — domain objects are never mutated; `Readonly<T>` is used at module boundaries.
- **Error model** — a single `AppError` hierarchy produces consistent HTTP status codes and response shapes.
- **Migrations** — sequential SQL files in `src/db/migrations/`, applied automatically at startup.
- **Testing** — unit and integration suites run under `bun:test`; target coverage is 80% or higher.
- **File and function limits** — files stay within 200–400 lines, functions under 50, nesting at most four levels deep.

## License

MIT
