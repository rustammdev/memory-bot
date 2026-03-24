# Memory Bot — YouTube Channel AI Agents

## Project Overview

YouTube kanallari uchun shaxsiy AI agentlar platformasi. Har bir agent o'z kanaliga mos xarakter, bilim va xotiraga ega bo'ladi. LangChain + Anthropic Claude asosida qurilgan.

## Tech Stack

- **Runtime**: Bun (NOT Node.js)
- **Language**: TypeScript (strict mode)
- **AI Framework**: LangChain.js (`langchain`, `@langchain/core`, `@langchain/anthropic`)
- **LLM**: Claude (Anthropic) via `@langchain/anthropic`
- **Database**: SQLite via `bun:sqlite` (agent memory, channel config)
- **Server**: `Bun.serve()` (NOT express)
- **Testing**: `bun test`

## Architecture

```
src/
├── agents/           # Agent factory va agent turlarini boshqarish
│   ├── agent-factory.ts    # Agent yaratish factory
│   ├── agent-runner.ts     # Agent ishga tushirish va chat loop
│   └── types.ts            # Agent type definitionlar
├── channels/         # YouTube kanal konfiguratsiyalari
│   ├── channel-loader.ts   # Kanal ma'lumotlarini yuklash
│   └── types.ts            # Channel type definitionlar
├── memory/           # Xotira tizimlari
│   ├── conversation-memory.ts  # Suhbat tarixi
│   ├── knowledge-store.ts      # Kanal bilim bazasi
│   └── types.ts                # Memory type definitionlar
├── prompts/          # System promptlar va templatelar
│   └── character-prompt.ts     # Karakter yaratish promptlari
├── config/           # Konfiguratsiya
│   └── index.ts                # Env va app config
├── db/               # Database
│   ├── schema.ts               # SQLite schema
│   └── migrations/             # DB migratsiyalar
└── utils/            # Yordamchi funksiyalar
    └── index.ts
```

## Key Concepts

### Agent = Channel Personality
Har bir YouTube kanali uchun agent:
- **Character**: Kanal uslubiga mos shaxsiyat (system prompt)
- **Memory**: Suhbat tarixi + kanal haqida bilimlar (persistent)
- **Knowledge**: Kanal kontenti haqida ma'lumotlar (RAG)

### Immutability
- NEVER mutate objects — always create new copies
- Use `Readonly<T>` and `ReadonlyArray<T>` for type safety

## Commands

```bash
bun run src/index.ts        # Start server
bun test                     # Run all tests
bun test --watch             # Watch mode
bun run src/cli.ts           # CLI chat interface
```

## Bun-Specific Rules

- Use `bun <file>` instead of `node <file>`
- Use `bun:sqlite` for SQLite (NOT better-sqlite3)
- Use `Bun.serve()` for HTTP (NOT express)
- Use `Bun.file()` for file I/O (NOT node:fs)
- Bun auto-loads `.env` — do NOT use dotenv
- Use `Bun.password.hash()` for password hashing

## Coding Standards

- **File size**: 200-400 lines typical, 800 max
- **Function size**: <50 lines
- **Nesting**: max 4 levels deep
- **Naming**: camelCase for variables/functions, PascalCase for types/classes
- **Exports**: Named exports only (NO default exports)
- **Errors**: Always handle explicitly, never swallow silently
- **Validation**: Validate all external input at boundaries

## Environment Variables

```
ANTHROPIC_API_KEY=           # Required — Claude API key
DATABASE_PATH=./data/bot.db  # SQLite database path
LOG_LEVEL=info               # debug | info | warn | error
```

## Testing

- Minimum 80% coverage
- TDD workflow: RED → GREEN → REFACTOR
- Test files: `*.test.ts` next to source files
- Use `bun:test` (NOT jest, vitest)

## Git

- Commits in English: `type(scope): description`
- Branch naming: `feat/`, `fix/`, `refactor/`
- PR titles in English with full description
