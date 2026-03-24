import { ok, fail } from "../lib/response";
import {
  getChannelVideos,
  getChannelMetadata,
  getChannelMetadataVersions,
} from "../services/channel.service";

function queryParam(req: Request, key: string): string | null {
  return new URL(req.url).searchParams.get(key);
}

export const channelRoutes = {
  "/api/channels/videos": {
    GET: async (req: Request) => {
      try {
        const result = await getChannelVideos(queryParam(req, "channel"));
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
  },

  "/api/channels/metadata": {
    GET: async (req: Request) => {
      try {
        const versionRaw = queryParam(req, "version");
        const version = versionRaw ? Number(versionRaw) : undefined;
        const result = await getChannelMetadata(
          queryParam(req, "channel"),
          version,
        );
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
  },

  "/api/channels/metadata/versions": {
    GET: async (req: Request) => {
      try {
        const result = await getChannelMetadataVersions(
          queryParam(req, "channel"),
        );
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
  },
} as const;
