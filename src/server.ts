import { createRoutes } from "./routes";
import { fail } from "./lib/response";
import { NotFoundError } from "./lib/errors";

export function startServer(port = 3000) {
  const server = Bun.serve({
    port,
    routes: createRoutes(),
    fetch() {
      return fail(new NotFoundError("Route not found"));
    },
  });

  console.log(`Server running at http://localhost:${server.port}`);
  return server;
}
