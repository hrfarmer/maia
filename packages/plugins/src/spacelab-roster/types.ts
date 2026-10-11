export interface ParsedRosterRow {
  discordHandle: string;
  status: string;
  adaptRoleValues: string[];
}

export type ParseLabRosterResult =
  | { ok: true; rows: ParsedRosterRow[]; adaptRoleValues: string[] }
  | { ok: false };
