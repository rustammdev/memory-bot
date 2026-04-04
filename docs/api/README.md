# Memory Bot — API Hujjatlar

## Fayllar

| Fayl                                  | Modul           | Prefix                         |
|---------------------------------------|-----------------|--------------------------------|
| [overview.md](overview.md)            | Umumiy          | —                              |
| [channels.md](channels.md)            | Channels        | `/api/channels/*`              |
| [transcripts.md](transcripts.md)      | Transcripts     | `/api/transcripts`             |
| [search.md](search.md)                | Search          | `/api/search`                  |
| [chat.md](chat.md)                    | Chat            | `/api/chat*`                   |
| [digests.md](digests.md)              | Digests         | `/api/digests*`                |
| [content-gaps.md](content-gaps.md)    | Content Gaps    | `/api/channels/content-gaps*`  |
| [knowledge.md](knowledge.md)          | Knowledge Graph | `/api/knowledge*`              |

## Boshlash Tartibi

Yangi kanal bilan ishlashda shu tartibda amalga oshiring:

```
1. GET  /api/channels/videos?channel=...        ← kanal + videolar yuklanadi
2. POST /api/channels/metadata?channel=...       ← AI metadata yaratiladi
3. POST /api/transcripts?videoId=...             ← transkript yuklanadi (har video uchun)
   └── (auto) chunk embeddings yaratiladi
   └── (auto) knowledge nodes/edges yaratiladi
4. POST /api/knowledge/build?channel=...         ← bilim grafi quriladi
5. GET  /api/search?channel=...&q=...            ← semantik qidiruv
6. POST /api/channels/content-gaps?channel=...   ← bo'shliq tahlili
7. POST /api/digests                             ← digest yaratiladi
8. POST /api/chat                                ← AI suhbat
```
