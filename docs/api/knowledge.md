# Knowledge Graph API

**Prefix:** `/api/knowledge`

Kanal transkriptlaridan chiqarilgan bilim grafi. Tushunchalar (nodes) va ularning o'rtasidagi bog'liqliklar (edges) dan iborat. O'rganish yo'llari, tushunchalar tadqiqoti, va kontent xaritasi uchun ishlatiladi.

---

## GET /api/knowledge/graph

Kanal uchun to'liq bilim grafini qaytaradi.

### Query Parameters

| Parametr  | Tip    | Majburiy | Tavsif                         |
|-----------|--------|----------|--------------------------------|
| `channel` | string | Ha       | Kanal username yoki YouTube ID |

### Response `200`

```json
{
  "ok": true,
  "data": {
    "channelName": "Caleb Curry",
    "handle": "CalebWritesCode",
    "category": "programming",
    "nodeCount": 87,
    "edgeCount": 134,
    "nodes": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "label": "React",
        "type": "framework",
        "description": "JavaScript UI library",
        "importance": 0.95,
        "mentionCount": 145
      },
      {
        "id": "...",
        "label": "useState",
        "type": "concept",
        "description": "React hook for managing local state",
        "importance": 0.82,
        "mentionCount": 87
      }
    ],
    "edges": [
      {
        "id": "...",
        "source": "useState-node-id",
        "target": "React-node-id",
        "relationship": "part_of",
        "weight": 0.9,
        "context": "useState is a built-in React hook"
      }
    ]
  }
}
```

### Node turlari (`type`)

| Tur         | Tavsif                              |
|-------------|-------------------------------------|
| `concept`   | Umumiy tushuncha (state, closure)  |
| `tool`      | Qurol (webpack, vite)              |
| `framework` | Framework (React, Next.js)         |
| `method`    | Metod/funksiya (useState, fetch)   |
| `person`    | Shaxs (Dan Abramov)                |
| `pattern`   | Pattern (Observer, MVC)            |
| `language`  | Dasturlash tili (TypeScript)       |
| `library`   | Kutubxona (Lodash, Axios)          |
| `platform`  | Platforma (Node.js, AWS)           |

### Edge turlari (`relationship`)

| Tur             | Tavsif                                      |
|-----------------|---------------------------------------------|
| `requires`      | A → B uchun B kerak                        |
| `part_of`       | A → B ning bir qismi                        |
| `related_to`    | A va B bog'liq                             |
| `alternative_to`| A → B ning muqobili                        |
| `extends`       | A → B ni kengaytiradi                       |
| `used_with`     | A va B birga ishlatiladi                    |
| `implements`    | A → B ni amalga oshiradi                    |

### Xatolar

| Status | Holat                          |
|--------|--------------------------------|
| 400    | `channel` parametri yo'q       |
| 404    | Kanal topilmadi                |

---

## POST /api/knowledge/build

Kanal uchun bilim grafini qurish/qayta qurish jarayonini ishga tushiradi (async).

### Query Parameters

| Parametr  | Tip     | Majburiy | Tavsif                                        |
|-----------|---------|----------|-----------------------------------------------|
| `channel` | string  | Ha       | Kanal username yoki YouTube ID                |
| `force`   | boolean | Yo'q     | Allaqachon qurilganlarni ham qayta ishlash (default: `false`) |

### Response `202 Accepted`

```json
{
  "ok": true,
  "data": {
    "channelId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "totalVideos": 42,
    "processedVideos": 0,
    "error": null,
    "startedAt": "2024-01-15T10:00:00Z",
    "completedAt": null
  }
}
```

### `status` qiymatlari

| Status       | Ma'nosi                                          |
|--------------|--------------------------------------------------|
| `pending`    | Navbatda, hali boshlanmagan                      |
| `processing` | Ishga tushgan, transkriptlar qayta ishlanmoqda   |
| `completed`  | Muvaffaqiyatli yakunlandi                        |
| `failed`     | Xato yuz berdi                                   |

### Xatolar

| Status | Holat                          |
|--------|--------------------------------|
| 400    | `channel` parametri yo'q       |
| 404    | Kanal topilmadi                |

### Ishlash jarayoni

Build darhol qaytmaydi — `GET /api/knowledge/build` orqali progress kuzatiladi:

```
1. Build yozuvi yaratiladi (status: "pending")
2. 202 qaytariladi (darhol)
3. Background:
   a. Har bir video uchun transkript yuklanadi
   b. AI transkriptdan nodes/edges chiqaradi
   c. Dublikat nodes birlashtirilib mention_count oshiriladi
   d. node_video_references saqlaniadi
   e. processedVideos oshib boradi
4. Hammasi tugagach (status: "completed")
```

---

## GET /api/knowledge/build

Build jarayonining holatini qaytaradi.

### Query Parameters

| Parametr  | Tip    | Majburiy | Tavsif                         |
|-----------|--------|----------|--------------------------------|
| `channel` | string | Ha       | Kanal username yoki YouTube ID |

### Response `200`

POST bilan bir xil format. `null` qaytarilishi mumkin — hali hech qanday build yo'q bo'lsa.

```json
{
  "ok": true,
  "data": {
    "channelId": "...",
    "status": "processing",
    "totalVideos": 42,
    "processedVideos": 15,
    "error": null,
    "startedAt": "2024-01-15T10:00:00Z",
    "completedAt": null
  }
}
```

---

## GET /api/knowledge/node

Muayyan node haqida batafsil ma'lumot — qaysi videolarda, qanday bog'liqliklar.

### Query Parameters

| Parametr | Tip    | Majburiy | Tavsif  |
|----------|--------|----------|---------|
| `id`     | string | Ha       | Node ID |

### Response `200`

```json
{
  "ok": true,
  "data": {
    "id": "550e8400-...",
    "label": "React",
    "type": "framework",
    "description": "JavaScript UI library for building user interfaces",
    "importance": 0.95,
    "mentionCount": 145,
    "videos": [
      {
        "videoId": "internal-uuid",
        "youtubeVideoId": "dQw4w9WgXcQ",
        "title": "Learn React in 30 Minutes",
        "context": "React is a JavaScript library developed by Meta",
        "relevance": 0.98
      }
    ],
    "neighbors": [
      {
        "nodeId": "...",
        "label": "useState",
        "type": "method",
        "relationship": "part_of",
        "direction": "incoming",
        "weight": 0.9
      },
      {
        "nodeId": "...",
        "label": "Next.js",
        "type": "framework",
        "relationship": "extends",
        "direction": "incoming",
        "weight": 0.85
      }
    ]
  }
}
```

### Xatolar

| Status | Holat              |
|--------|--------------------|
| 400    | `id` parametri yo'q |

---

## GET /api/knowledge/path

Ikki tushuncha orasidagi o'rganish yo'lini topadi (BFS/shortest path).

### Query Parameters

| Parametr  | Tip    | Majburiy | Tavsif                         |
|-----------|--------|----------|--------------------------------|
| `channel` | string | Ha       | Kanal username yoki YouTube ID |
| `from`    | string | Ha       | Boshlang'ich tushuncha         |
| `to`      | string | Ha       | Maqsad tushuncha               |

### Response `200` — Yo'l topildi

```json
{
  "ok": true,
  "data": {
    "from": "JavaScript",
    "to": "React Hooks",
    "found": true,
    "path": [
      {
        "nodeId": "...",
        "label": "JavaScript",
        "type": "language",
        "relationship": null
      },
      {
        "nodeId": "...",
        "label": "React",
        "type": "framework",
        "relationship": "requires"
      },
      {
        "nodeId": "...",
        "label": "React Hooks",
        "type": "concept",
        "relationship": "part_of"
      }
    ],
    "totalSteps": 3
  }
}
```

### Response `200` — Yo'l topilmadi

```json
{
  "ok": true,
  "data": {
    "from": "Kubernetes",
    "to": "React Hooks",
    "found": false,
    "path": [],
    "totalSteps": 0
  }
}
```

### Xatolar

| Status | Holat                                    |
|--------|------------------------------------------|
| 400    | `channel`, `from`, yoki `to` yo'q        |
| 404    | Kanal topilmadi                          |

---

## GET /api/knowledge/suggest

Mavzu bo'yicha tegishli tushunchalar va videolar taklifi.

### Query Parameters

| Parametr  | Tip    | Majburiy | Tavsif                         |
|-----------|--------|----------|--------------------------------|
| `channel` | string | Ha       | Kanal username yoki YouTube ID |
| `topic`   | string | Ha       | Qidiriladigan mavzu            |

### Response `200`

```json
{
  "ok": true,
  "data": {
    "node": {
      "id": "...",
      "label": "useState",
      "type": "method",
      "description": "React hook for local state management",
      "importance": 0.82,
      "mentionCount": 87
    },
    "related": [
      {
        "label": "useReducer",
        "type": "method",
        "relationship": "alternative_to"
      },
      {
        "label": "React",
        "type": "framework",
        "relationship": "part_of"
      }
    ],
    "videos": [
      {
        "title": "Learn React Hooks",
        "youtubeVideoId": "dQw4w9WgXcQ"
      }
    ]
  }
}
```

> **Eslatma:** `node` null bo'lishi mumkin — mavzu grafda topilmasa.

### Xatolar

| Status | Holat                          |
|--------|--------------------------------|
| 400    | `channel` yoki `topic` yo'q    |
| 404    | Kanal topilmadi                |

---

## GET /api/knowledge/stats

Kanal bilim grafi statistikasini qaytaradi.

### Query Parameters

| Parametr  | Tip    | Majburiy | Tavsif                         |
|-----------|--------|----------|--------------------------------|
| `channel` | string | Ha       | Kanal username yoki YouTube ID |

### Response `200`

```json
{
  "ok": true,
  "data": {
    "channelName": "Caleb Curry",
    "nodeCount": 87,
    "edgeCount": 134,
    "topTypes": [
      { "type": "concept", "count": 32 },
      { "type": "method", "count": 25 },
      { "type": "framework", "count": 15 },
      { "type": "library", "count": 10 },
      { "type": "pattern", "count": 5 }
    ]
  }
}
```

### Xatolar

| Status | Holat                          |
|--------|--------------------------------|
| 400    | `channel` parametri yo'q       |
| 404    | Kanal topilmadi                |

---

## Ma'lumotlar Bazasi Sxemasi

### `knowledge_nodes` jadvali

| Ustun              | Tip          | Tavsif                               |
|--------------------|--------------|--------------------------------------|
| `id`               | UUID (PK)    |                                      |
| `channel_id`       | UUID (FK)    | → channels.id                       |
| `label`            | TEXT         | Tushuncha nomi                       |
| `normalized_label` | TEXT         | Kichik harf + normalize qilingan     |
| `type`             | TEXT         | Node turi (concept, framework, ...)  |
| `description`      | TEXT         | Qisqacha tavsif                      |
| `importance`       | REAL         | 0-1 oralig'ida muhimlik              |
| `mention_count`    | INTEGER      | Transkriptlarda necha marta tilga olingan |
| `created_at`       | TIMESTAMPTZ  |                                      |
| `updated_at`       | TIMESTAMPTZ  |                                      |
| UNIQUE             |              | `(channel_id, normalized_label)`     |

### `knowledge_edges` jadvali

| Ustun         | Tip          | Tavsif                                   |
|---------------|--------------|------------------------------------------|
| `id`          | UUID (PK)    |                                          |
| `channel_id`  | UUID (FK)    | → channels.id                           |
| `source_id`   | UUID (FK)    | → knowledge_nodes.id                    |
| `target_id`   | UUID (FK)    | → knowledge_nodes.id                    |
| `relationship`| TEXT         | Bog'liqlik turi                          |
| `weight`      | REAL         | Bog'liqlik kuchi (0-1)                   |
| `context`     | TEXT         | Qo'shimcha kontekst                      |
| `created_at`  | TIMESTAMPTZ  |                                          |
| UNIQUE        |              | `(source_id, target_id, relationship)`   |

### `node_video_references` jadvali

| Ustun        | Tip          | Tavsif                                   |
|--------------|--------------|------------------------------------------|
| `id`         | UUID (PK)    |                                          |
| `node_id`    | UUID (FK)    | → knowledge_nodes.id                    |
| `video_id`   | UUID (FK)    | → videos.id                             |
| `chunk_id`   | UUID (FK?)   | → chunk_embeddings.id (null bo'lishi mumkin) |
| `context`    | TEXT         | O'sha videodagi kontekst                 |
| `relevance`  | REAL         | 0-1 oralig'ida dolzarblik               |
| `created_at` | TIMESTAMPTZ  |                                          |
| UNIQUE       |              | `(node_id, video_id, chunk_id)`          |

### `knowledge_builds` jadvali

| Ustun              | Tip          | Tavsif                           |
|--------------------|--------------|----------------------------------|
| `id`               | UUID (PK)    |                                  |
| `channel_id`       | UUID (FK)    | → channels.id                   |
| `status`           | TEXT         | pending/processing/completed/failed |
| `total_videos`     | INTEGER      | Umumiy videolar soni             |
| `processed_videos` | INTEGER      | Qayta ishlangan videolar soni    |
| `error`            | TEXT         | Xato xabari                      |
| `started_at`       | TIMESTAMPTZ  |                                  |
| `completed_at`     | TIMESTAMPTZ  |                                  |

### `knowledge_processed_videos` jadvali

| Ustun        | Tip          | Tavsif                                     |
|--------------|--------------|--------------------------------------------|
| `channel_id` | UUID (PK,FK) | → channels.id                             |
| `video_id`   | UUID (PK,FK) | → videos.id                               |
| `built_at`   | TIMESTAMPTZ  | Qachon qayta ishlangan                     |

> Bu jadval `force=false` bo'lganda qayta ishlangan videolarni kuzatib boradi.
