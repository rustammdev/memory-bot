function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}

const DATABASE_URL = requireEnv("DATABASE_URL");
const DEEPSEEK_API_KEY = requireEnv("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = requireEnv("OPENAI_API_KEY");

function parseDatabaseUrl(url: string): {
  host: string;
  port: number;
  user: string;
  password: string;
  dbname: string;
} {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: Number(parsed.port) || 5432,
    user: parsed.username || "postgres",
    password: parsed.password || "",
    dbname: parsed.pathname.replace("/", "") || "memory_bot",
  };
}

export function createMemoryConfig() {
  const db = parseDatabaseUrl(DATABASE_URL);
  return {
    version: "v1.1" as const,
    llm: {
      provider: "openai" as const,
      config: {
        apiKey: DEEPSEEK_API_KEY,
        model: "deepseek-chat",
        baseURL: "https://api.deepseek.com/v1",
      },
    },
    embedder: {
      provider: "openai" as const,
      config: {
        apiKey: OPENAI_API_KEY,
        model: "text-embedding-3-small",
      },
    },
    vectorStore: {
      provider: "pgvector" as const,
      config: {
        host: db.host,
        port: db.port,
        user: db.user,
        password: db.password,
        dbname: db.dbname,
        collectionName: "agent_memories",
        embeddingModelDims: 1536,
      },
    },
    disableHistory: true,
  };
}
