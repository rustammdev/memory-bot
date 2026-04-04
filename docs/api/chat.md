# Chat API

**Prefix:** `/api/chat`

LangChain ReAct agenti bilan suhbat. Har bir kanal o'z agentiga ega — kanal kontentini biladigan, foydalanuvchi xotirasini saqlaydigan, bir nechta toollardan foydalanadigan AI chatbot.

---

## POST /api/chat

Bitta kanal agenti bilan suhbat.

### Request Body

```json
{
  "channel": "CalebWritesCode",
  "userId": "user-123",
  "message": "Bu kanalda React haqida qanday videolar bor?",
  "history": [
    {
      "role": "user",
      "content": "Salom"
    },
    {
      "role": "assistant",
      "content": "Salom! Qanday yordam bera olaman?"
    }
  ]
}
```

### Request Body maydonlari

| Maydon    | Tip            | Majburiy | Tavsif                                              |
|-----------|----------------|----------|-----------------------------------------------------|
| `channel` | string         | Ha       | Kanal username yoki YouTube ID                      |
| `userId`  | string         | Ha       | Foydalanuvchi identifikatori (xotira uchun)         |
| `message` | string         | Ha       | Foydalanuvchi xabari                                |
| `history` | ChatMessage[]  | Yo'q     | Oldingi suhbat tarixi (default: `[]`)               |

### `ChatMessage` formati

```typescript
{
  role: "user" | "assistant",
  content: string
}
```

### Response `200`

```json
{
  "ok": true,
  "data": {
    "channelName": "Caleb Curry",
    "handle": "CalebWritesCode",
    "reply": "Kanalda React bo'yicha 12 ta video bor. Eng mashhuri 'Learn React in 30 Minutes' (150,000 ko'rishlar). Asosiy mavzular: useState, useEffect, React Router, va custom hooks."
  }
}
```

### Xatolar

| Status | Holat                          |
|--------|--------------------------------|
| 400    | Body validatsiya xatosi        |
| 404    | Kanal topilmadi                |
| 502    | AI API (DeepSeek) xatosi       |

### Side Effects

1. **Memory recall** — Suhbat boshlanishida mem0 orqali foydalanuvchining oldingi faktlari yuklonadi
2. **Agent execution** — LangChain ReAct agenti toollar ishlatib javob tuzadi
3. **Memory save** (background) — Suhbat yakunida yangi faktlar mem0 ga saqlanadi

---

## POST /api/chat/multi

Bir vaqtning o'zida bir nechta kanal agentlari bilan suhbat. Kanallarni taqqoslash yoki ko'p kanaldan ma'lumot olish uchun.

### Request Body

```json
{
  "channels": ["CalebWritesCode", "FireshipIO", "TraversyMedia"],
  "userId": "user-123",
  "message": "Qaysi kanalda TypeScript bo'yicha eng yaxshi kontent bor?",
  "history": []
}
```

### Request Body maydonlari

| Maydon     | Tip            | Majburiy | Tavsif                                          |
|------------|----------------|----------|-------------------------------------------------|
| `channels` | string[]       | Ha       | Kanal ro'yxati (2 dan 10 tagacha)              |
| `userId`   | string         | Ha       | Foydalanuvchi identifikatori                    |
| `message`  | string         | Ha       | Foydalanuvchi xabari                            |
| `history`  | ChatMessage[]  | Yo'q     | Suhbat tarixi (default: `[]`)                  |

### Validatsiya

- `channels.length >= 2` — kamida 2 ta kanal bo'lishi kerak
- `channels.length <= 10` — 10 tadan oshmasligi kerak
- Barcha kanallar bazada mavjud bo'lishi kerak

### Response `200`

```json
{
  "ok": true,
  "data": {
    "channels": [
      { "name": "Caleb Curry", "handle": "CalebWritesCode" },
      { "name": "Fireship", "handle": "FireshipIO" },
      { "name": "Brad Traversy", "handle": "TraversyMedia" }
    ],
    "reply": "TypeScript bo'yicha Fireship kanalida eng ko'p va chuqur kontent bor — 25 ta video, asosan advanced patterns va best practices haqida. CalebWritesCode esa boshlang'ich daraja uchun yaxshiroq..."
  }
}
```

### Xatolar

| Status | Holat                                               |
|--------|-----------------------------------------------------|
| 400    | Body validatsiya xatosi, channels soni noto'g'ri    |
| 400    | Bir yoki bir nechta kanal topilmadi                 |
| 502    | AI API xatosi                                       |

---

## GET /api/chat/memories

Foydalanuvchining mem0 xotirasini qaytaradi. Agent buni suhbat boshida context sifatida ishlatadi.

### Query Parameters

| Parametr  | Tip    | Majburiy | Tavsif                         |
|-----------|--------|----------|--------------------------------|
| `channel` | string | Ha       | Kanal username yoki YouTube ID |
| `userId`  | string | Ha       | Foydalanuvchi identifikatori   |

### Response `200`

```json
{
  "ok": true,
  "data": {
    "channelName": "Caleb Curry",
    "memories": "User is learning React. Previously asked about hooks and performance optimization. Interested in TypeScript integration."
  }
}
```

> **Eslatma:** `memories` bo'sh string (`""`) bo'lishi mumkin — hali saqlangan xotira yo'q bo'lsa.

### Xatolar

| Status | Holat                          |
|--------|--------------------------------|
| 400    | `channel` yoki `userId` yo'q   |
| 404    | Kanal topilmadi                |

---

## Agent Toollari

### Bitta Kanal Agenti Toollari

| Tool                   | Maqsad                                              |
|------------------------|-----------------------------------------------------|
| `list_videos`          | Kanal videolarini sarlavha bo'yicha ko'rish/qidirish |
| `get_transcript`       | Muayyan videoning to'liq transkriptini o'qish        |
| `semantic_search`      | Transkriptlarda ma'no bo'yicha qidiruv               |
| `get_channel_info`     | Kanal haqida umumiy ma'lumot                         |
| `get_latest_digest`    | So'nggi haftalik xulosa                              |
| `find_content_gaps`    | Kanalda qaysi mavzular yoritilmagan                  |
| `explore_knowledge_graph` | Tushunchalar o'rtasidagi bog'liqlikni ko'rish    |
| `find_learning_path`   | Ikki tushuncha o'rtasidagi o'rganish yo'li           |

### Ko'p Kanal Agenti Toollari

| Tool                   | Maqsad                                              |
|------------------------|-----------------------------------------------------|
| `cross_channel_search` | Barcha kanallarda bir vaqtda semantik qidiruv        |
| `list_channel_videos`  | Muayyan kanalning videolarini ko'rish                |
| `get_transcript`       | Muayyan videoning transkriptini o'qish               |
| `get_channel_overview` | Muayyan kanalning metadata ma'lumotlari              |

---

## Xotira Tizimi (mem0)

Har bir `(channel, userId)` juftligi uchun alohida xotira saqlanadi:

```
Suhbat boshida:
  mem0.recallMemories(channel_id, userId) → relevant context string

Suhbat yakunida (background):
  mem0.saveConversation(channel_id, userId, message, reply) → yangi faktlar chiqariladi
```

mem0 avtomatik ravishda:
- Faktlarni chiqaradi (`user likes TypeScript`)
- Dublikatlarni birlashtiradi
- Eskirgan faktlarni yangilaydi
