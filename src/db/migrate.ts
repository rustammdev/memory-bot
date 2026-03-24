import { join } from "node:path";
import { db } from "./connection";

const MIGRATIONS_DIR = join(import.meta.dir, "migrations");

export async function runMigrations() {
  await db`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const applied = await db`SELECT name FROM _migrations ORDER BY name`;
  const appliedSet = new Set(applied.map((r) => r.name as string));

  const glob = new Bun.Glob("*.sql");
  const files = Array.from(glob.scanSync(MIGRATIONS_DIR)).sort();

  for (const file of files) {
    if (appliedSet.has(file)) continue;

    const sql = await Bun.file(join(MIGRATIONS_DIR, file)).text();

    await db.begin(async (tx) => {
      await tx.unsafe(sql);
      await tx`INSERT INTO _migrations (name) VALUES (${file})`;
    });

    console.log(`Applied migration: ${file}`);
  }
}
