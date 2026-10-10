import { helloCommand } from "./hello.js";
import { memberCommand } from "./member.js";
import { roleCommand } from "./role.js";
import type { MaiaCommand } from "./types.js";

export const commands: MaiaCommand[] = [
  helloCommand,
  roleCommand,
  memberCommand,
];

export const commandsByName = new Map(
  commands.map((command) => [command.data.name, command]),
);
