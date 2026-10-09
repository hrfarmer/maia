import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(here, "../../..");

dotenv.config({ path: path.join(workspaceRoot, ".env") });
dotenv.config();
