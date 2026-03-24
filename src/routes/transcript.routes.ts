import { ok, fail } from "../lib/response";
import { queryParam } from "../lib/request";
import {
  getTranscript,
  fetchAndSaveTranscript,
} from "../services/transcript.service";

export const transcriptRoutes = {
  "/api/transcripts": {
    GET: async (req: Request) => {
      try {
        const result = await getTranscript(
          queryParam(req, "videoId"),
          queryParam(req, "lang") ?? undefined,
        );
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
    POST: async (req: Request) => {
      try {
        const result = await fetchAndSaveTranscript(
          queryParam(req, "videoId"),
          queryParam(req, "lang") ?? undefined,
        );
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
  },
} as const;
