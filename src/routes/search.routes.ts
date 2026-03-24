import { ok, fail } from "../lib/response";
import { queryParam, queryParamInt } from "../lib/request";
import { searchChannelContent } from "../services/search.service";

export const searchRoutes = {
  "/api/search": {
    GET: async (req: Request) => {
      try {
        const result = await searchChannelContent(
          queryParam(req, "channel"),
          queryParam(req, "q"),
          queryParamInt(req, "limit") ?? 5,
        );
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
  },
} as const;
