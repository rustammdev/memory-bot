import { ok, fail } from "../lib/response";
import { queryParam, requireParam } from "../lib/request";
import {
  buildChannelGraph,
  getChannelBuildStatus,
  getChannelGraph,
  getNodeDetails,
  findLearningPath,
  suggestForTopic,
} from "../services/knowledge.service";
import * as knowledgeRepo from "../repositories/knowledge.repo";
import { requireChannel } from "../services/channel.helpers";

export const knowledgeRoutes = {
  "/api/knowledge/graph": {
    GET: async (req: Request) => {
      try {
        const result = await getChannelGraph(queryParam(req, "channel"));
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
  },

  "/api/knowledge/build": {
    POST: async (req: Request) => {
      try {
        const force = queryParam(req, "force") === "true";
        const result = await buildChannelGraph(queryParam(req, "channel"), force);
        return ok(result, 202);
      } catch (err) {
        return fail(err);
      }
    },
    GET: async (req: Request) => {
      try {
        const result = await getChannelBuildStatus(queryParam(req, "channel"));
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
  },

  "/api/knowledge/node": {
    GET: async (req: Request) => {
      try {
        const nodeId = requireParam(queryParam(req, "id"), "id");
        const result = await getNodeDetails(nodeId);
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
  },

  "/api/knowledge/path": {
    GET: async (req: Request) => {
      try {
        const channel = queryParam(req, "channel");
        const from = requireParam(queryParam(req, "from"), "from");
        const to = requireParam(queryParam(req, "to"), "to");
        const result = await findLearningPath(channel, from, to);
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
  },

  "/api/knowledge/suggest": {
    GET: async (req: Request) => {
      try {
        const channel = queryParam(req, "channel");
        const topic = requireParam(queryParam(req, "topic"), "topic");
        const result = await suggestForTopic(channel, topic);
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
  },

  "/api/knowledge/stats": {
    GET: async (req: Request) => {
      try {
        const channel = await requireChannel(queryParam(req, "channel"));
        const stats = await knowledgeRepo.getGraphStats(channel.id);
        return ok({ channelName: channel.name, ...stats });
      } catch (err) {
        return fail(err);
      }
    },
  },
} as const;
