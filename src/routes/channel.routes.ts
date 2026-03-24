import { ok, fail } from "../lib/response";
import { queryParam, queryParamInt } from "../lib/request";
import {
  getChannelVideos,
  getChannelMetadata,
  getChannelMetadataVersions,
  generateMetadata,
} from "../services/channel.service";

export const channelRoutes = {
  "/api/channels/videos": {
    GET: async (req: Request) => {
      try {
        const transcribed = queryParam(req, "transcribed") === "true";
        const result = await getChannelVideos(queryParam(req, "channel"), { transcribedOnly: transcribed });
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
  },

  "/api/channels/metadata": {
    GET: async (req: Request) => {
      try {
        const version = queryParamInt(req, "version");
        const result = await getChannelMetadata(
          queryParam(req, "channel"),
          version,
        );
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
    POST: async (req: Request) => {
      try {
        const result = await generateMetadata(queryParam(req, "channel"));
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
