import { ok, fail } from "../lib/response";
import { queryParam } from "../lib/request";
import {
  analyzeChannelGaps,
  getLatestAnalysis,
  getAnalysisVersions,
} from "../services/content-gap.service";

export const contentGapRoutes = {
  "/api/channels/content-gaps": {
    GET: async (req: Request) => {
      try {
        const result = await getLatestAnalysis(queryParam(req, "channel"));
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
    POST: async (req: Request) => {
      try {
        const force = queryParam(req, "force") === "true";
        const result = await analyzeChannelGaps(queryParam(req, "channel"), force);
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
  },

  "/api/channels/content-gaps/versions": {
    GET: async (req: Request) => {
      try {
        const result = await getAnalysisVersions(queryParam(req, "channel"));
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
  },
} as const;
