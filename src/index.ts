import { runMigrations } from "./db/migrate";
import { startServer } from "./server";

function isConnectionError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("Connection closed") ||
    msg.includes("connection refused") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("no response")
  );
}

async function waitForDb(retries = 5, delayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await runMigrations();
      return;
    } catch (error: unknown) {
      if (!isConnectionError(error)) throw error;

      if (attempt === retries) {
        console.error(
          `\n  ✖ PostgreSQL ga ulanib bo'lmadi (${retries} urinishdan keyin).\n\n` +
            `  DATABASE_URL: ${process.env.DATABASE_URL ?? "(not set)"}\n\n` +
            `  PostgreSQL ishga tushganligini tekshiring:\n` +
            `    docker compose up -d\n`,
        );
        process.exit(1);
      }

      console.log(`  ⏳ PostgreSQL kutilmoqda... (${attempt}/${retries})`);
      await Bun.sleep(delayMs);
    }
  }
}

await waitForDb();
startServer();
