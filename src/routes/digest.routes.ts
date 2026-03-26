import { z } from "zod";
import { ok, fail } from "../lib/response";
import { queryParam, queryParamInt, parseBody } from "../lib/request";
import {
  generateChannelDigest,
  getLatestDigest,
  getDigestHistory,
} from "../services/digest.service";

const generateDigestSchema = z.object({
  channel: z.string().min(1),
  userId: z.string().optional(),
  periodDays: z.number().int().min(1).max(30).optional(),
  force: z.boolean().optional().default(false),
});

export const digestRoutes = {
  "/api/digests": {
    GET: async (req: Request) => {
      try {
        const version = queryParamInt(req, "version");
        const result = await getLatestDigest(queryParam(req, "channel"), version);
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
    POST: async (req: Request) => {
      try {
        const body = await parseBody(req, generateDigestSchema);
        const result = await generateChannelDigest(body);
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
  },

  "/api/digests/history": {
    GET: async (req: Request) => {
      try {
        const limit = queryParamInt(req, "limit") ?? 10;
        const result = await getDigestHistory(queryParam(req, "channel"), limit);
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
  },
} as const;
