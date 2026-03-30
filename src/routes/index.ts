import { channelRoutes } from "./channel.routes";
import { transcriptRoutes } from "./transcript.routes";
import { searchRoutes } from "./search.routes";
import { chatRoutes } from "./chat.routes";
import { digestRoutes } from "./digest.routes";
import { contentGapRoutes } from "./content-gap.routes";
import { knowledgeRoutes } from "./knowledge.routes";
import { createLogger } from "../lib/logger";

const log = createLogger("http");

type Handler = (req: Request) => Promise<Response> | Response;
type Methods = Record<string, Handler>;
type RouteMap = Record<string, Methods>;

function withLogging(routes: RouteMap): RouteMap {
  const wrapped: RouteMap = {};

  for (const [path, methods] of Object.entries(routes)) {
    wrapped[path] = {};
    for (const [method, handler] of Object.entries(methods)) {
      wrapped[path][method] = async (req: Request) => {
        const done = log.time(`${method} ${path}`);
        const res = await handler(req);
        done({ status: res.status });
        return res;
      };
    }
  }

  return wrapped;
}

export function createRoutes() {
  return withLogging({
    ...channelRoutes,
    ...transcriptRoutes,
    ...searchRoutes,
    ...chatRoutes,
    ...digestRoutes,
    ...contentGapRoutes,
    ...knowledgeRoutes,
  } as RouteMap);
}
