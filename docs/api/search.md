# Search API

**Prefix:** `/api/search`

Kanal transkriptlari bo'yicha semantik (ma'noga asoslangan) qidiruv. Oddiy kalit so'z emas, ma'no bo'yicha qidiradi — `"react hooks tutorial"` so'roviga hooks haqida gapirgan barcha videolar chiqadi.

---

## GET /api/search

Kanal transkriptlarida semantik qidiruv.

### Query Parameters

| Parametr  | Tip     | Majburiy | Tavsif                                     |
|-----------|---------|----------|--------------------------------------------|
| `channel` | string  | Ha       | Kanal username yoki YouTube ID             |
| `q`       | string  | Ha       | Qidiruv so'rovi (tabiiy til)               |
| `limit`   | integer | Yo'q     | Maksimal natijalar soni (default: `5`)     |

### Response `200`

```json
{
  "ok": true,
  "data": [
    {
      "videoTitle": "Learn React Hooks in 30 Minutes",
      "videoUrl": "https://youtube.com/watch?v=dQw4w9WgXcQ",
      "content": "useEffect is called after every render by default. You can control when it runs by passing a dependency array...",
      "similarity": 0.92
    },
    {
      "videoTitle": "React State Management Deep Dive",
      "videoUrl": "https://youtube.com/watch?v=abc123",
      "content": "useState and useReducer are the two main hooks for managing local state...",
      "similarity": 0.87
    }
  ]
}
```

### Response maydonlari

| Maydon       | Tip    | Tavsif                                       |
|--------------|--------|----------------------------------------------|
| `videoTitle` | string | Video sarlavhasi                             |
| `videoUrl`   | string | YouTube video URL                            |
| `content`    | string | Transkript bo'lagi (query bilan mos kelgan) |
| `similarity` | float  | O'xshashlik darajasi 0 dan 1 gacha           |

### Xatolar

| Status | Holat                                        |
|--------|----------------------------------------------|
| 400    | `channel` yoki `q` parametri yo'q            |
| 404    | Kanal topilmadi                              |
| 502    | OpenAI Embedding API xatosi                  |

---

## Qanday Ishlaydi

```
1. So'rov matni → OpenAI text-embedding-3-small → vektor [1536 float]
2. Vektor → pgvector cosine_similarity qidirovi → mos chunk_embeddings
3. Natijalar similarity bo'yicha tartiblangan holda qaytariladi
```

**Muhim:** Qidiruv ishlashi uchun videoning transkripti vectorized bo'lishi kerak (`transcripts.vectorized = true`). Yangi qo'shilgan transkript vectorize bo'lgunga qadar (bir necha soniya) qidiruv natijasida ko'rinmaydi.

---

## Foydalanish misollari

```
GET /api/search?channel=CalebWritesCode&q=react state management
GET /api/search?channel=CalebWritesCode&q=how to use typescript with react&limit=10
GET /api/search?channel=CalebWritesCode&q=database optimization techniques
```
