# Transcripts API

**Prefix:** `/api/transcripts`

Video transkriptlarini olish va saqlash. Transkript barcha AI funksiyalarning asosi — Search, KnowledgeGraph, ContentGap hammasi transkriptga bog'liq.

---

## GET /api/transcripts

Video transkriptini qaytaradi (agar mavjud bo'lsa).

### Query Parameters

| Parametr  | Tip    | Majburiy | Tavsif                                   |
|-----------|--------|----------|------------------------------------------|
| `videoId` | string | Ha       | YouTube video ID (masalan: `dQw4w9WgXcQ`) |
| `lang`    | string | Yo'q     | Til kodi (default: `"en"`)               |

### Response `200` — Transkript mavjud

```json
{
  "ok": true,
  "data": {
    "transcript": {
      "videoId": "550e8400-e29b-41d4-a716-446655440000",
      "language": "en",
      "content": "Welcome to this tutorial on React hooks...",
      "summary": "This video covers useState, useEffect and useContext hooks in React.",
      "vectorized": true,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  }
}
```

### Response `200` — Transkript yo'q

```json
{
  "ok": true,
  "data": {
    "transcript": null,
    "message": "Transcript not found for this video"
  }
}
```

### Xatolar

| Status | Holat                          |
|--------|--------------------------------|
| 400    | `videoId` parametri yo'q       |
| 404    | Video topilmadi                |

---

## POST /api/transcripts

YouTube'dan transkriptni yuklab saqlaydi. Mavjud bo'lsa keshdan qaytaradi.

### Query Parameters

| Parametr  | Tip     | Majburiy | Tavsif                                            |
|-----------|---------|----------|---------------------------------------------------|
| `videoId` | string  | Ha       | YouTube video ID                                  |
| `lang`    | string  | Yo'q     | Til kodi (default: `"en"`)                        |
| `force`   | boolean | Yo'q     | Keshni o'tkazib, qayta yuklash (default: `false`) |

### Response `200`

GET bilan bir xil format.

### Xatolar

| Status | Holat                              |
|--------|------------------------------------|
| 400    | `videoId` parametri yo'q           |
| 404    | Video topilmadi                    |
| 502    | YouTube'dan transkript olib bo'lmadi |

### Side Effects (async — background)

POST muvaffaqiyatli bo'lgandan keyin background'da quyidagilar ishlaydi:

1. **Vectorization** — Transkript matnini chunklarga bo'lib, embedding yaratadi va `chunk_embeddings` jadvaliga saqlaydi
2. **Knowledge Extraction** — Transkriptdan bilim tugunlari (nodes) va qirralari (edges) chiqarib `knowledge_nodes` / `knowledge_edges` jadvallariga saqlaydi
3. **Summary generation** — AI yordamida qisqacha xulosa yaratiladi

Ushbu jarayonlar tugagach, `transcripts.vectorized = true` bo'ladi.

---

## Ma'lumotlar Bazasi Sxemasi

### `transcripts` jadvali

| Ustun        | Tip          | Tavsif                                     |
|--------------|--------------|--------------------------------------------|
| `id`         | UUID (PK)    |                                            |
| `video_id`   | UUID (FK)    | → videos.id                               |
| `content`    | TEXT         | To'liq transkript matni                    |
| `summary`    | TEXT         | AI tomonidan yaratilgan qisqacha xulosa    |
| `language`   | TEXT         | Til kodi (masalan: `"en"`)                 |
| `vectorized` | BOOLEAN      | Embedding yaratilganmi?                    |
| `created_at` | TIMESTAMPTZ  |                                            |
| UNIQUE       |              | `(video_id, language)`                     |

### `chunk_embeddings` jadvali

| Ustun           | Tip             | Tavsif                              |
|-----------------|-----------------|-------------------------------------|
| `id`            | UUID (PK)       |                                     |
| `channel_id`    | UUID (FK)       | → channels.id                      |
| `video_id`      | UUID (FK)       | → videos.id                        |
| `transcript_id` | UUID (FK)       | → transcripts.id                   |
| `chunk_index`   | INTEGER         | Bo'lak tartib raqami                |
| `content`       | TEXT            | Bo'lak matni                        |
| `embedding`     | vector(1536)    | OpenAI text-embedding-3-small vektori |
| `importance`    | REAL            | Muhimlik darajasi (0-1)             |
| `created_at`    | TIMESTAMPTZ     |                                     |

---

## Transkript Va Boshqa Modullar

```
POST /api/transcripts
  → transcript saqlandi
  → (async) chunk_embeddings yaratildi
        → GET /api/search — semantik qidiruv ishlaydi
        → POST /api/channels/content-gaps — tahlil ishlaydi
  → (async) knowledge_nodes/edges yaratildi
        → GET /api/knowledge/graph — bilim grafi ishlaydi
```

Transkript bo'lmasa:
- **Search** — natija topilmaydi
- **ContentGap** — "5 ta chunk kerak" xatosi
- **KnowledgeGraph** — bo'sh graf
- **Chat** — ishlaydi, lekin videolar haqida ma'lumot kam bo'ladi
