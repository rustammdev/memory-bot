import { createRoutes } from "./routes";
import { fail } from "./lib/response";
import { NotFoundError } from "./lib/errors";
import { createLogger } from "./lib/logger";

const log = createLogger("server");

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

export function startServer(port = 3001) {
  const indexFile = Bun.file("public/index.html");

  const server = Bun.serve({
    port,
    idleTimeout: 180,
    routes: createRoutes(),
    fetch(req) {
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      const { pathname } = new URL(req.url);

      if (pathname === "/" || pathname === "/index.html") {
        return withCors(new Response(indexFile, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }));
      }

      return withCors(fail(new NotFoundError("Route not found")));
    },
  });

  log.info(`listening on port ${server.port}`);
  return server;
}
