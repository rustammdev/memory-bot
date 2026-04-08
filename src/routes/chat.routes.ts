import { ok, fail } from "../lib/response";
import { queryParam, requireParam, parseBody } from "../lib/request";
import { chat, multiChat, chatStream, multiChatStream } from "../services/chat.service";
import { getUserMemories } from "../memory/client";
import { requireChannel } from "../services/channel.helpers";
import { chatRequestSchema, multiChatRequestSchema } from "../types/chat";
import { CORS_HEADERS } from "../lib/cors";
import { type SseEvent, serializeSseEvent } from "../lib/sse";

const SSE_HEADERS = {
  ...CORS_HEADERS,
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

function sseStream(events: AsyncGenerator<SseEvent>): Response {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const enqueue = (event: SseEvent) =>
        controller.enqueue(encoder.encode(serializeSseEvent(event)));
      try {
        for await (const event of events) {
          enqueue(event);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream error";
        enqueue({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(readable, { headers: SSE_HEADERS });
}

export const chatRoutes = {
  "/api/chat": {
    POST: async (req: Request) => {
      try {
        const body = await parseBody(req, chatRequestSchema);
        const result = await chat(body);
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
  },

  "/api/chat/multi": {
    POST: async (req: Request) => {
      try {
        const body = await parseBody(req, multiChatRequestSchema);
        const result = await multiChat(body);
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
  },

  "/api/chat/stream": {
    POST: async (req: Request) => {
      try {
        const body = await parseBody(req, chatRequestSchema);
        return sseStream(chatStream(body));
      } catch (err) {
        return fail(err);
      }
    },
  },

  "/api/chat/multi/stream": {
    POST: async (req: Request) => {
      try {
        const body = await parseBody(req, multiChatRequestSchema);
        return sseStream(multiChatStream(body));
      } catch (err) {
        return fail(err);
      }
    },
  },

  "/api/chat/memories": {
    GET: async (req: Request) => {
      try {
        const channelInput = requireParam(queryParam(req, "channel"), "channel");
        const userId = requireParam(queryParam(req, "userId"), "userId");

        const channel = await requireChannel(channelInput);
        const memories = await getUserMemories({
          userId,
          agentId: channel.id,
        });
        return ok({ channelName: channel.name, memories });
      } catch (err) {
        return fail(err);
      }
    },
  },
} as const;
