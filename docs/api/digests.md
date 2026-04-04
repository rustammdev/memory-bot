# Digests API

**Prefix:** `/api/digests`

Kanal uchun haftalik AI digest (xulosa). Yangi videolar, trend tahlili, mashhur kontentlar va mavzu klasterlarini o'z ichiga oladi.

---

## GET /api/digests

Kanal uchun so'nggi digest yoki muayyan versiyani qaytaradi.

### Query Parameters

| Parametr  | Tip     | Majburiy | Tavsif                                    |
|-----------|---------|----------|-------------------------------------------|
| `channel` | string  | Ha       | Kanal username yoki YouTube ID            |
| `version` | integer | Yo'q     | Muayyan versiyani olish (default: oxirgi) |

### Response `200` — Digest mavjud

```json
{
  "ok": true,
  "data": {
    "channelName": "Caleb Curry",
    "handle": "CalebWritesCode",
    "digest": {
      "version": 5,
      "periodStart": "2024-01-08",
      "periodEnd": "2024-01-15",
      "summary": "Bu hafta React 19 va Next.js 14 bo'yicha 3 ta yangi video chiqdi. Server Components mavzusi kanalda eng ko'p muhokama qilinmoqda.",
      "highlights": [
        {
          "videoId": "dQw4w9WgXcQ",
          "title": "React 19 What's New",
          "reason": "Hafta ichida eng tez o'sgan video — 24 soatda 50,000 ko'rish",
          "viewVelocity": 2083.3
        }
      ],
      "topicClusters": [
        {
          "topic": "React 19 Features",
          "videoIds": ["dQw4w9WgXcQ", "abc123"],
          "description": "React 19 ning yangi xususiyatlari: Actions, useOptimistic, Server Components"
        },
        {
          "topic": "Next.js App Router",
          "videoIds": ["xyz789"],
          "description": "App Router bilan routing va layout management"
        }
      ],
      "trendAnalysis": "Server-side rendering va React Server Components mavzusi o'sib bormoqda. Foydalanuvchilar hooks va state management dan tashqari performance mavzusiga qiziqish bildirmoqda.",
      "newVideoCount": 3,
      "totalViews": 285000,
      "generatedAt": "2024-01-15T12:00:00Z"
    }
  }
}
```

### Response `200` — Digest yo'q

```json
{
  "ok": true,
  "data": {
    "channelName": "Caleb Curry",
    "handle": "CalebWritesCode",
    "digest": null
  }
}
```

### Xatolar

| Status | Holat                          |
|--------|--------------------------------|
| 400    | `channel` parametri yo'q       |
| 404    | Kanal topilmadi                |

---

## POST /api/digests

Yangi digest yaratadi.

### Request Body

```json
{
  "channel": "CalebWritesCode",
  "userId": "user-123",
  "periodDays": 7,
  "force": false
}
```

### Request Body maydonlari

| Maydon      | Tip     | Majburiy | Tavsif                                                   |
|-------------|---------|----------|----------------------------------------------------------|
| `channel`   | string  | Ha       | Kanal username yoki YouTube ID                           |
| `userId`    | string  | Yo'q     | Foydalanuvchi ID (personalizatsiya uchun)               |
| `periodDays`| integer | Yo'q     | Digest davri kunlarda (1-30, default: `7`)               |
| `force`     | boolean | Yo'q     | Keshni o'tkazib, qayta yaratish (default: `false`)       |

### Validatsiya

- `periodDays` 1 dan 30 gacha bo'lishi kerak

### Response `200`

GET bilan bir xil format.

### Xatolar

| Status | Holat                          |
|--------|--------------------------------|
| 400    | Body validatsiya xatosi        |
| 400    | `periodDays` 1-30 dan tashqari |
| 404    | Kanal topilmadi                |
| 502    | AI API xatosi                  |

### Ishlash jarayoni

```
1. Yangi digest yozuvi yaratiladi (status: "pending")
2. Belgilangan davr ichidagi videolar tanlanadi
3. View velocity hisoblanadi (ko'rishlar / kunlar)
4. Videolar klasterlarga ajratiladi (mavzular bo'yicha)
5. AI xulosa, trendlar va highlights yaratadi (status: "generating")
6. Persona uslubida formatlash (kanal kategoriyasiga qarab)
7. Saqlash (status: "completed")
```

Xato bo'lsa: `status: "failed"`, `error_message` saqlanadi.

---

## GET /api/digests/history

Kanal digestlarining tarixini qaytaradi.

### Query Parameters

| Parametr  | Tip     | Majburiy | Tavsif                                        |
|-----------|---------|----------|-----------------------------------------------|
| `channel` | string  | Ha       | Kanal username yoki YouTube ID                |
| `limit`   | integer | Yo'q     | Maksimal digestlar soni (default: `10`)       |

### Response `200`

```json
{
  "ok": true,
  "data": {
    "channelName": "Caleb Curry",
    "digests": [
      {
        "id": "550e8400-...",
        "channel_id": "...",
        "version": 5,
        "status": "completed",
        "period_start": "2024-01-08T00:00:00Z",
        "period_end": "2024-01-15T00:00:00Z",
        "new_video_count": 3,
        "total_views": 285000,
        "summary": "...",
        "highlights": [...],
        "topic_clusters": [...],
        "trend_analysis": "...",
        "persona_style": "energetic",
        "generated_at": "2024-01-15T12:00:00Z",
        "error_message": null,
        "created_at": "2024-01-15T11:00:00Z"
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

### `digests` jadvali

| Ustun             | Tip          | Tavsif                                          |
|-------------------|--------------|-------------------------------------------------|
| `id`              | UUID (PK)    |                                                 |
| `channel_id`      | UUID (FK)    | → channels.id                                  |
| `version`         | INTEGER      | Versiya (har kanal uchun)                       |
| `status`          | ENUM         | `pending` / `generating` / `completed` / `failed` |
| `period_start`    | TIMESTAMPTZ  | Digest davr boshi                               |
| `period_end`      | TIMESTAMPTZ  | Digest davr oxiri                               |
| `new_video_count` | INTEGER      | Davr ichidagi yangi videolar soni               |
| `total_views`     | BIGINT       | Davr ichidagi umumiy ko'rishlar                 |
| `summary`         | TEXT         | AI tomonidan yozilgan xulosa                    |
| `highlights`      | JSONB        | Array: `{ videoId, title, reason, viewVelocity }` |
| `topic_clusters`  | JSONB        | Array: `{ topic, videoIds, description }`       |
| `trend_analysis`  | TEXT         | Trend tahlili matni                             |
| `persona_style`   | TEXT         | Kanal kategoriyasiga mos uslub                  |
| `generated_at`    | TIMESTAMPTZ  | Yaratilgan vaqt                                 |
| `error_message`   | TEXT         | Xato bo'lsa sabab                               |
| `created_at`      | TIMESTAMPTZ  |                                                 |
| UNIQUE            |              | `(channel_id, version)`                         |

---

## Persona Uslublari

Digest matni kanal kategoriyasiga qarab turli uslubda yoziladi:

| Kategoriya      | Uslub              |
|-----------------|--------------------|
| `programming`   | Texnik, aniq       |
| `gaming`        | Energetik, jonli   |
| `education`     | Rasmiy, ta'limiy   |
| `entertainment` | Qiziqarli, do'stona|
| `business`      | Professional       |
| `other`         | Neytral            |
