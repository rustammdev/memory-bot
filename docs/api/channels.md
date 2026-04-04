# Channels API

**Prefix:** `/api/channels`

Kanallarni boshqarish, videolarni ko'rish, metadatani olish va yaratish uchun.

---

## GET /api/channels/videos

Kanalning barcha videolarini qaytaradi. Kanal bazada bo'lmasa, YouTube'dan yuklab saqlaydi.

### Query Parameters

| Parametr      | Tip       | Majburiy | Tavsif                                        |
|---------------|-----------|----------|-----------------------------------------------|
| `channel`     | string    | Ha       | Kanal username yoki YouTube ID                |
| `transcribed` | boolean   | Yo'q     | Faqat transkripti borlarni qaytarish (default: false) |

### Response `200`

```json
{
  "ok": true,
  "data": {
    "channelName": "Caleb Curry",
    "handle": "CalebWritesCode",
    "videoCount": 42,
    "videos": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "youtube_video_id": "dQw4w9WgXcQ",
        "title": "Learn React in 30 Minutes",
        "view_count": 150000,
        "duration_sec": 1800,
        "duration_formatted": "30:00",
        "transcribed": true
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
| 502    | YouTube API xatosi             |

### Side Effects

- Kanal bazada yo'q bo'lsa → YouTube'dan yuklab saqlaydi
- `transcribed: true` belgisi — transcript mavjudligini ko'rsatadi

---

## GET /api/channels/metadata

Kanalning metadata ma'lumotlarini qaytaradi (overview, category, language).

### Query Parameters

| Parametr  | Tip     | Majburiy | Tavsif                                 |
|-----------|---------|----------|----------------------------------------|
| `channel` | string  | Ha       | Kanal username yoki YouTube ID         |
| `version` | integer | Yo'q     | Muayyan versiyani olish (default: oxirgi) |

### Response `200`

```json
{
  "ok": true,
  "data": {
    "channelName": "Caleb Curry",
    "avatarUrl": "https://...",
    "bannerUrl": "https://...",
    "metadata": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "version": 3,
      "overview": "Dasturlash bo'yicha qo'llanmalar...",
      "associated_video_types": "tutorials, walkthroughs",
      "category": "programming",
      "language": "en",
      "created_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

> **Eslatma:** `metadata` null bo'lishi mumkin — hali yaratilmagan bo'lsa.

### Xatolar

| Status | Holat                          |
|--------|--------------------------------|
| 400    | `channel` parametri yo'q       |
| 404    | Kanal topilmadi                |

---

## POST /api/channels/metadata

AI yordamida kanal metadatasini yaratadi.

### Query Parameters

| Parametr  | Tip     | Majburiy | Tavsif                                  |
|-----------|---------|----------|-----------------------------------------|
| `channel` | string  | Ha       | Kanal username yoki YouTube ID          |
| `force`   | boolean | Yo'q     | Keshni o'tkazib, qayta yaratish (default: false) |

### Response `200`

GET /api/channels/metadata bilan bir xil format.

### Xatolar

| Status | Holat                             |
|--------|-----------------------------------|
| 400    | `channel` parametri yo'q          |
| 404    | Kanal topilmadi                   |
| 502    | AI API xatosi                     |

### Side Effects

- Yangi `channel_metadata` yozuvi yaratiladi (versiyalangan)
- AI so'nggi video sarlavhalarini tahlil qilib metadata chiqaradi
- Agar allaqachon mavjud bo'lsa va `force=false` — keshdan qaytaradi

---

## GET /api/channels/metadata/versions

Kanal metadatasining barcha versiyalarini qaytaradi.

### Query Parameters

| Parametr  | Tip    | Majburiy | Tavsif                         |
|-----------|--------|----------|--------------------------------|
| `channel` | string | Ha       | Kanal username yoki YouTube ID |

### Response `200`

```json
{
  "ok": true,
  "data": {
    "versions": [
      {
        "id": "...",
        "channel_id": "...",
        "version": 1,
        "overview": "...",
        "associated_video_types": "...",
        "category": "programming",
        "language": "en",
        "created_at": "2024-01-10T08:00:00Z"
      },
      {
        "id": "...",
        "channel_id": "...",
        "version": 2,
        "overview": "...",
        "associated_video_types": "...",
        "category": "programming",
        "language": "en",
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

### `channels` jadvali

| Ustun             | Tip          | Tavsif                         |
|-------------------|--------------|--------------------------------|
| `id`              | UUID (PK)    |                                |
| `youtube_id`      | TEXT (UNIQUE)|                                |
| `username`        | TEXT (UNIQUE)|                                |
| `name`            | TEXT         |                                |
| `followers`       | INTEGER      |                                |
| `video_count`     | INTEGER      |                                |
| `avatar_url`      | TEXT         |                                |
| `banner_url`      | TEXT         |                                |
| `last_synced_at`  | TIMESTAMPTZ  |                                |
| `created_at`      | TIMESTAMPTZ  |                                |
| `updated_at`      | TIMESTAMPTZ  |                                |

### `videos` jadvali

| Ustun              | Tip          | Tavsif                        |
|--------------------|--------------|-------------------------------|
| `id`               | UUID (PK)    |                               |
| `channel_id`       | UUID (FK)    | → channels.id                 |
| `youtube_video_id` | TEXT (UNIQUE)|                               |
| `title`            | TEXT         |                               |
| `url`              | TEXT         |                               |
| `view_count`       | INTEGER      |                               |
| `duration_sec`     | INTEGER      |                               |
| `duration_formatted` | TEXT       |                               |
| `uploaded_at`      | TIMESTAMPTZ  |                               |
| `synced_at`        | TIMESTAMPTZ  |                               |
| `created_at`       | TIMESTAMPTZ  |                               |

### `channel_metadata` jadvali

| Ustun                   | Tip          | Tavsif                       |
|-------------------------|--------------|------------------------------|
| `id`                    | UUID (PK)    |                              |
| `channel_id`            | UUID (FK)    | → channels.id                |
| `version`               | INTEGER      | Versiya (har kanal uchun)    |
| `overview`              | TEXT         |                              |
| `associated_video_types`| TEXT         |                              |
| `category`              | ENUM         | `channel_category`           |
| `language`              | ENUM         | `channel_language`           |
| `created_at`            | TIMESTAMPTZ  |                              |
| UNIQUE                  |              | `(channel_id, version)`      |

### `channel_category` enum qiymatlari

`programming`, `design`, `business`, `science`, `gaming`, `education`, `entertainment`, `news`, `lifestyle`, `other`

### `channel_language` enum qiymatlari

`en`, `uz`, `ru`, `es`, `fr`, `de`, `zh`, `ja`, `ko`, `other`
