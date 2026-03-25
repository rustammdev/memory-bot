import { ok, fail } from "../lib/response";
import { ValidationError } from "../lib/errors";
import { queryParam, requireParam } from "../lib/request";
import { chat } from "../services/chat.service";
import { getUserMemories } from "../memory/client";
import { requireChannel } from "../services/channel.helpers";
import { isValidChatMessage } from "../types/chat";

export const chatRoutes = {
  "/api/chat": {
    POST: async (req: Request) => {
      try {
        const body = (await req.json()) as Record<string, unknown>;

        if (!body.channel || typeof body.channel !== "string") {
          throw new ValidationError("channel is required");
        }
        if (!body.message || typeof body.message !== "string") {
          throw new ValidationError("message is required");
        }
        if (!body.userId || typeof body.userId !== "string") {
          throw new ValidationError("userId is required");
        }

        const history = Array.isArray(body.history)
          ? body.history.filter(isValidChatMessage)
          : undefined;

        const result = await chat({
          channel: body.channel,
          message: body.message,
          userId: body.userId,
          history,
        });
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
