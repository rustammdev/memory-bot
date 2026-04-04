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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

function withCors(response: Response): Response {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

function withLogging(routes: RouteMap): RouteMap {
  const wrapped: RouteMap = {};

  for (const [path, methods] of Object.entries(routes)) {
    wrapped[path] = {};
    // Add OPTIONS handler for CORS preflight
    wrapped[path]["OPTIONS"] = () => new Response(null, { status: 204, headers: CORS_HEADERS });
    for (const [method, handler] of Object.entries(methods)) {
      wrapped[path][method] = async (req: Request) => {
        const done = log.time(`${method} ${path}`);
        const res = withCors(await handler(req));
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
