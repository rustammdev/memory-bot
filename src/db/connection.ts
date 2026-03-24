import { SQL } from "bun";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

export const db = new SQL({ url: databaseUrl });

export async function closeDb() {
  await db.close();
}
