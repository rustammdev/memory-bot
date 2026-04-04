# Content Gaps API

**Prefix:** `/api/channels/content-gaps`

Kanal uchun kontent bo'shliqlari tahlili. Mavjud transkript embeddinglarini klasterlaydi, qaysi mavzular yoritilmagan yoki kam yoritilganligini AI orqali topadi.

---

## GET /api/channels/content-gaps

So'nggi kontent bo'shliq tahlilini qaytaradi.

### Query Parameters

| Parametr  | Tip    | Majburiy | Tavsif                         |
|-----------|--------|----------|--------------------------------|
| `channel` | string | Ha       | Kanal username yoki YouTube ID |

### Response `200` — Tahlil mavjud

```json
{
  "ok": true,
  "data": {
    "channelName": "Caleb Curry",
    "handle": "CalebWritesCode",
    "category": "programming",
    "analyzedAt": "2024-01-15T10:00:00Z",
    "totalVideosAnalyzed": 42,
    "totalChunksAnalyzed": 380,
    "topicsCovered": [
      {
        "id": 0,
        "label": "React Hooks",
        "description": "useState, useEffect, useContext va boshqa React hooks",
        "videoCount": 8,
        "representativeVideoTitles": [
          "Learn React Hooks",
          "Custom Hooks Tutorial",
          "useEffect Deep Dive"
        ]
      },
      {
        "id": 1,
        "label": "TypeScript Basics",
        "description": "TypeScript turlari, interfeys va generics",
        "videoCount": 5,
        "representativeVideoTitles": [
          "TypeScript for Beginners",
          "TypeScript with React"
        ]
      }
    ],
    "gaps": [
      {
        "topic": "Testing React Applications",
        "reason": "Kanalda testing haqida birorta ham video yo'q, ammo bu React ekosistemida muhim mavzu",
        "confidence": "high",
        "priority": 95,
        "category": "programming",
        "adjacentTopics": ["React Hooks", "TypeScript Basics"],
        "suggestedVideoTitle": "React Testing Library: Complete Guide 2024",
        "suggestedAngle": "Jest + React Testing Library bilan unit va integration testlar yozish"
      },
      {
        "topic": "React Performance Optimization",
        "reason": "useMemo va useCallback minimal darajada ko'rib chiqilgan",
        "confidence": "medium",
        "priority": 78,
        "category": "programming",
        "adjacentTopics": ["React Hooks"],
        "suggestedVideoTitle": "React Performance: useMemo, useCallback and memo()",
        "suggestedAngle": "Qachon va qanday optimallashtirish kerakligini real misollar bilan ko'rsatish"
      }
    ],
    "summary": "Kanal React asoslari va TypeScript bo'yicha yaxshi kontent bor, lekin testing, performance optimization va state management (Redux/Zustand) mavzulari kam yoritilgan."
  }
}
```

### Response `200` — Tahlil yo'q

```json
{
  "ok": true,
  "data": null
}
```

### `gaps` massividagi maydonlar

| Maydon                | Tip                         | Tavsif                                         |
|-----------------------|-----------------------------|------------------------------------------------|
| `topic`               | string                      | Bo'shliq mavzusi                               |
| `reason`              | string                      | Nima uchun bu muhim                            |
| `confidence`          | `"high"/"medium"/"low"`     | AI ishonch darajasi                            |
| `priority`            | integer (0-100)             | Qanchalik muhim (yuqori = ko'proq muhim)       |
| `category`            | string                      | Kanal kategoriyasi                             |
| `adjacentTopics`      | string[]                    | Mavjud qaysi mavzularga yaqin                  |
| `suggestedVideoTitle` | string                      | Tavsiya etilgan video sarlavhasi               |
| `suggestedAngle`      | string                      | Video qanday angle olishi kerak               |

### Xatolar

| Status | Holat                          |
|--------|--------------------------------|
| 400    | `channel` parametri yo'q       |
| 404    | Kanal topilmadi                |

---

## POST /api/channels/content-gaps

Kanal uchun yangi kontent bo'shliq tahlilini ishga tushiradi.

### Query Parameters

| Parametr  | Tip     | Majburiy | Tavsif                                            |
|-----------|---------|----------|---------------------------------------------------|
| `channel` | string  | Ha       | Kanal username yoki YouTube ID                    |
| `force`   | boolean | Yo'q     | 7 kunlik keshni o'tkazib qayta tahlil (default: `false`) |

### Response `200`

GET bilan bir xil format.

### Xatolar

| Status | Holat                                                         |
|--------|---------------------------------------------------------------|
| 400    | `channel` parametri yo'q                                      |
| 400    | Kamida 5 ta vectorized chunk kerak (embedding yetarli emas)  |
| 404    | Kanal topilmadi                                              |
| 502    | AI API xatosi                                                 |

### Shart

Ishga tushirish uchun:
1. Kanal mavjud bo'lishi kerak
2. Kamida 5 ta `chunk_embeddings` yozuvi bo'lishi kerak — ya'ni kamida bir nechta transkript vectorize qilingan
3. Kanal metadatasi bo'lishi kerak (`POST /api/channels/metadata`)

### Ishlash jarayoni

```
1. chunk_embeddings dan barcha vektorlar yuklanadi
2. K-means klasterizatsiya — o'xshash mavzular birlashtiriladi
3. Har bir klasterdan AI orqali mavzu nomi chiqariladi
4. Niche-specific reference mavzular bilan taqqoslanadi
5. Qoplab olmagan mavzular gap sifatida belgilanadi
6. AI qo'shimcha kontekst, tavsiya, priority va confidence qo'shadi
7. Yangi versiya saqlanadi
```

### Kesh

`force=false` bo'lsa va oxirgi tahlil 7 kundan yangi bo'lsa → keshdan qaytaradi.

---

## GET /api/channels/content-gaps/versions

Kanal kontent bo'shliq tahlili tarixini qaytaradi.

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
    "versions": [
      {
        "id": "550e8400-...",
        "channel_id": "...",
        "version": 1,
        "total_videos_analyzed": 35,
        "total_chunks_analyzed": 310,
        "topics_covered": [...],
        "gaps": [...],
        "summary": "...",
        "created_at": "2024-01-08T10:00:00Z"
      },
      {
        "id": "...",
        "channel_id": "...",
        "version": 2,
        "total_videos_analyzed": 42,
        "total_chunks_analyzed": 380,
        "topics_covered": [...],
        "gaps": [...],
        "summary": "...",
        "created_at": "2024-01-15T10:00:00Z"
      }
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

### `content_gap_analyses` jadvali

| Ustun                   | Tip          | Tavsif                                         |
|-------------------------|--------------|------------------------------------------------|
| `id`                    | UUID (PK)    |                                                |
| `channel_id`            | UUID (FK)    | → channels.id                                 |
| `version`               | INTEGER      | Versiya (har kanal uchun avtomatik o'sadi)     |
| `total_videos_analyzed` | INTEGER      | Tahlil qilingan videolar soni                  |
| `total_chunks_analyzed` | INTEGER      | Tahlil qilingan chunk_embeddings soni          |
| `topics_covered`        | JSONB        | Yoritilgan mavzular massivi                    |
| `gaps`                  | JSONB        | Bo'shliqlar massivi                            |
| `summary`               | TEXT         | Umumiy xulosa                                  |
| `created_at`            | TIMESTAMPTZ  |                                                |
| UNIQUE                  |              | `(channel_id, version)`                        |

---

## Modullar bilan bog'liqlik

```
ContentGap tahlili ishlashi uchun:

channels → videos → transcripts → chunk_embeddings
                                         ↑
                              (vectorized bo'lishi kerak)

channels → channel_metadata
                 ↑
      (kategoriya niche topics uchun kerak)
```
