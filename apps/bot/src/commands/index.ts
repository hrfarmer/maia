import { helloCommand } from "./hello.js";
import type { MaiaCommand } from "./types.js";

export const commands: MaiaCommand[] = [helloCommand];

export const commandsByName = new Map(
  commands.map((command) => [command.data.name, command]),
);
