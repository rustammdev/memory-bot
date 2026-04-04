# Memory Bot — API Overview

## Base URL

```
http://localhost:3000
```

---

## Umumiy Response Format

Barcha endpointlar bir xil envelope ishlatadi:

### Muvaffaqiyatli javob (2xx)

```json
{
  "ok": true,
  "data": { }
}
```

### Xato javob (4xx / 5xx)

```json
{
  "ok": false,
  "error": "xato tavsifi"
}
```

---

## HTTP Status Kodlari

| Status | Holat                    |
|--------|--------------------------|
| 200    | Muvaffaqiyatli           |
| 201    | Yaratildi                |
| 202    | Qabul qilindi (async)    |
| 400    | Validation xatosi        |
| 404    | Topilmadi                |
| 409    | Konflikt                 |
| 502    | Tashqi servis xatosi     |
| 500    | Server xatosi            |

---

## Xato Turlari

| Sinf                 | Status | Holat                                |
|----------------------|--------|--------------------------------------|
| `ValidationError`    | 400    | So'rov parametrlari noto'g'ri         |
| `NotFoundError`      | 404    | Resurs topilmadi                     |
| `ConflictError`      | 409    | Resurs allaqachon mavjud             |
| `ExternalServiceError` | 502  | YouTube / AI API xatosi              |

---

## Modullar va Endpointlar

| Modul           | Prefix                          | Fayl                              |
|-----------------|---------------------------------|-----------------------------------|
| Channels        | `/api/channels/*`               | `routes/channel.routes.ts`        |
| Transcripts     | `/api/transcripts`              | `routes/transcript.routes.ts`     |
| Search          | `/api/search`                   | `routes/search.routes.ts`         |
| Chat            | `/api/chat*`                    | `routes/chat.routes.ts`           |
| Digests         | `/api/digests*`                 | `routes/digest.routes.ts`         |
| Content Gaps    | `/api/channels/content-gaps*`   | `routes/content-gap.routes.ts`    |
| Knowledge Graph | `/api/knowledge*`               | `routes/knowledge.routes.ts`      |

---

## Modullar o'rtasidagi bog'liqlik

```
Channel (kanal)
  └── Video (videolar ro'yxati)
        └── Transcript (transkript matni)
              ├── ChunkEmbeddings (vektor bo'laklari)
              │     ├── Search — semantik qidiruv
              │     ├── ContentGap — mavzu bo'shliqlari
              │     └── KnowledgeGraph — bilim grafi
              └── KnowledgeGraph extraction
  ├── ChannelMetadata (AI tomonidan yaratilgan)
  ├── Digest (haftalik xulosalar)
  └── Chat (AI agent suhbati)
        └── Memory (mem0 — foydalanuvchi xotirasi)
```

### Ketma-ket bog'liqlik

1. **Channel** — barcha narsaning asosi. Kanal bo'lmasa, hech narsa ishlamaydi.
2. **Videos** — kanal qo'shilganda avtomatik yuklanadi.
3. **Transcript** — POST bilan yuklanadi. Mavjud bo'lmasa, Search va Knowledge ishlamaydi.
4. **ChunkEmbeddings** — Transcript saqlanganidan keyin background'da yaratiladi. Search va ContentGap uchun kerak.
5. **ChannelMetadata** — AI tomonidan yaratiladi. ContentGap uchun shart.
6. **Digest** — Kanal + videolar + AI kerak.
7. **ContentGap** — Metadata + minimum 5 ta chunk embedding kerak.
8. **KnowledgeGraph** — Transcript mavjud bo'lishi kerak.
9. **Chat** — Kanal mavjud bo'lishi kerak. Memory ixtiyoriy.

---

## `channel` Parametri

Ko'p endpointlar `channel` parametrini qabul qiladi. Bu:
- YouTube kanal `username` (masalan: `@CalebWritesCode` yoki `CalebWritesCode`)
- YouTube kanal ID (masalan: `UCxxx...`)

Har ikki formatni ham qabul qiladi, sistem ichida avtomatik aniqlanadi.

---

## Async Operatsiyalar

Quyidagi operatsiyalar background'da ishlaydi va darhol javob qaytaradi:

| Operatsiya                    | Trigger                        |
|-------------------------------|-------------------------------|
| Transcript vectorization      | POST /api/transcripts         |
| Knowledge graph extraction    | POST /api/transcripts         |
| Channel metadata generation   | POST /api/channels/metadata   |
| Knowledge graph build         | POST /api/knowledge/build     |

---

## Fayl Strukturasi

```
src/routes/           ← HTTP yo'nalishlar (faqat so'rov/javob)
src/services/         ← Biznes logika va orchestratsiya
src/repositories/     ← Ma'lumotlar bazasiga murojaat (Bun.sql)
src/agent/            ← LangChain ReAct agentlari
src/memory/           ← mem0 xotira qatlami
src/ai/               ← DeepSeek API chaqiruvlari
src/vector/           ← Embedding va semantik qidiruv
src/lib/              ← Umumiy infratuzilma (errors, response, request)
src/db/migrations/    ← PostgreSQL migratsiya fayllari
```
