import { ok, fail } from "../lib/response";
import { getChannelVideos } from "../services/channel.service";

export const channelRoutes = {
  "/api/channels/videos": {
    POST: async (req: Request) => {
      try {
        const body = (await req.json()) as Record<string, unknown>;
        const result = await getChannelVideos(body.channel);
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
  },
} as const;
