import { createRoutes } from "./routes";
import { fail } from "./lib/response";
import { NotFoundError } from "./lib/errors";
import { createLogger } from "./lib/logger";
import { CORS_HEADERS, withCors } from "./lib/cors";

const log = createLogger("server");

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
