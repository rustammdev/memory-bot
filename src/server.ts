import { createRoutes } from "./routes";
import { fail } from "./lib/response";
import { NotFoundError } from "./lib/errors";
import { createLogger } from "./lib/logger";

const log = createLogger("server");

export function startServer(port = 3000) {
  const indexFile = Bun.file("public/index.html");

  const server = Bun.serve({
    port,
    idleTimeout: 180,
    routes: createRoutes(),
    fetch(req) {
      const { pathname } = new URL(req.url);

      if (pathname === "/" || pathname === "/index.html") {
        return new Response(indexFile, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      return fail(new NotFoundError("Route not found"));
    },
  });

  log.info(`listening on port ${server.port}`);
  return server;
}
