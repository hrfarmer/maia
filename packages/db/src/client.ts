import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

let client: ReturnType<typeof postgres> | undefined;

export function getDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!client) {
    client = postgres(connectionString, { max: 10 });
  }
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof getDb>;
