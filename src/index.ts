import { runMigrations } from "./db/migrate";
import { startServer } from "./server";

await runMigrations();
startServer();
