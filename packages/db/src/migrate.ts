import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  const migrationsFolder = path.join(__dirname, "..", "drizzle");
  await migrate(db, { migrationsFolder });
  await sql.end();
  console.log("Migrations complete");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
