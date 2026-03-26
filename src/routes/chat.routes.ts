import { ok, fail } from "../lib/response";
import { queryParam, requireParam, parseBody } from "../lib/request";
import { chat, multiChat } from "../services/chat.service";
import { getUserMemories } from "../memory/client";
import { requireChannel } from "../services/channel.helpers";
import { chatRequestSchema, multiChatRequestSchema } from "../types/chat";

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
