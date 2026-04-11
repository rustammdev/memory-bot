# memory-bot

> Per-channel YouTube AI agents with persistent memory, semantic search, smart digests, and content gap analysis.

Memory Bot turns any YouTube channel into a conversational AI agent with its own character, knowledge, and long-term memory. Each channel becomes an addressable agent you can chat with about its videos, get weekly trend digests from, and ask for content gap recommendations.

Built on **LangChain.js** (ReAct agent) + **DeepSeek** (LLM) + **mem0** (persistent memory via pgvector) + **Bun** + **PostgreSQL**.

## Features

- **Per-channel agents** — each channel is an isolated LangChain ReAct agent with its own tools and memory
- **Persistent memory (mem0)** — auto-extracted facts, deduplication, recall across sessions
- **Semantic search** — OpenAI embeddings + pgvector over transcript chunks
- **Smart Digest** — weekly AI-generated channel digest with view velocity scoring and persona-aware narration
- **Content Gap Finder** — K-means clustering over embeddings + niche reference topics to rank recommended video ideas
- **DB-first strategy** — PostgreSQL first, fall back to `yt-dlp` only when data is missing
- **Versioned metadata** — channel metadata is auto-incremented; history available via a separate endpoint

## Stack

| Layer | Tech |
|---|---|
| Runtime | **Bun** (not Node.js) |
| Language | TypeScript (strict) |
| Server | `Bun.serve()` |
| Database | PostgreSQL via `Bun.sql` |
| LLM | DeepSeek (via `@langchain/openai`) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Memory | [mem0](https://github.com/mem0ai/mem0) (pgvector backend) |
| Agent | LangChain.js ReAct agent |
| Ingestion | `yt-dlp` (subprocess) |

## Architecture

```
Routes → Services → Repositories → PostgreSQL
                 → Agent module   → LangChain (createAgent + tools)
                 → Memory module  → mem0 (pgvector + DeepSeek)
                 → AI module      → DeepSeek API (metadata, summarization)
                 → YT module      → yt-dlp (external)
```

- **Routes** — HTTP only: parse request, call service, format response
- **Services** — business logic, validation, orchestration
- **Agent** — per-channel ReAct agent with tools (`list_videos`, `get_transcript`, `semantic_search`, `get_latest_digest`, `find_content_gaps`)
- **Memory** — `recallMemories()` before each turn, `saveConversation()` after (non-blocking)
- **Vector** — chunk → embed → pgvector store → k-means clustering for gap analysis

## Getting started

```bash
bun install
cp .env.example .env     # set DATABASE_URL, DEEPSEEK_API_KEY, OPENAI_API_KEY
bun run start            # runs migrations then boots the server
```

### Environment

```env
DATABASE_URL=postgres://user:pass@localhost:5432/memory_bot
DEEPSEEK_API_KEY=         # LLM + metadata + summarization
OPENAI_API_KEY=           # embeddings (text-embedding-3-small)
LOG_LEVEL=info            # debug | info | warn | error
```

## API

```http
GET  /api/channels/videos?channel=CalebWritesCode
GET  /api/channels/metadata?channel=CalebWritesCode
GET  /api/channels/metadata/versions?channel=CalebWritesCode
GET  /api/transcripts?videoId=dQw4w9WgXcQ
POST /api/transcripts?videoId=dQw4w9WgXcQ
GET  /api/search?channel=CalebWritesCode&q=react+hooks
POST /api/chat                                    # agent chat
GET  /api/digests?channel=CalebWritesCode
POST /api/digests                                 # generate digest
GET  /api/channels/content-gaps?channel=CalebWritesCode
```

### Chat example

```json
POST /api/chat
{
  "channel": "CalebWritesCode",
  "userId":  "user-123",
  "message": "What React videos does this channel have?",
  "history": []
}
```

## Commands

```bash
bun run dev         # watch mode
bun run migrate     # migrations only
bun test            # run tests
```

## License

MIT
