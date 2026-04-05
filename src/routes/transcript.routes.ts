import { ok, fail } from "../lib/response";
import { queryParam, queryParamInt } from "../lib/request";
import {
  getTranscript,
  fetchAndSaveTranscript,
  fetchAndSaveBatch,
  type BatchResult,
} from "../services/transcript.service";

const BATCH_DEFAULT_LIMIT = 20;
const BATCH_MAX_LIMIT = 100;

function sseEvent(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function parseVideoIds(raw: string | null): ReadonlyArray<string> | undefined {
  if (!raw) return undefined;
  const ids = raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  return ids.length > 0 ? ids : undefined;
}

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
        const force = queryParam(req, "force") === "true";
        const result = await fetchAndSaveTranscript(
          queryParam(req, "videoId"),
          queryParam(req, "lang") ?? undefined,
          force,
        );
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
  },

  "/api/transcripts/batch": {
    POST: async (req: Request) => {
      const channel = queryParam(req, "channel");
      const force = queryParam(req, "force") === "true";
      const lang = queryParam(req, "lang") ?? "en";
      const limitRaw = queryParamInt(req, "limit") ?? BATCH_DEFAULT_LIMIT;
      const limit = Math.max(1, Math.min(BATCH_MAX_LIMIT, limitRaw));
      const videoIds = parseVideoIds(queryParam(req, "videoIds"));

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const encode = (data: object) =>
            controller.enqueue(encoder.encode(sseEvent(data)));

          try {
            const onResult = (result: BatchResult) => {
              encode({ type: "progress", ...result });
            };

            const summary = await fetchAndSaveBatch(
              channel,
              { language: lang, force, limit, videoIds },
              onResult,
            );

            encode({
              type: "done",
              total: summary.total,
              succeeded: summary.succeeded,
              failed: summary.failed,
              skipped: summary.skipped,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            encode({ type: "error", error: message });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    },
  },
} as const;
