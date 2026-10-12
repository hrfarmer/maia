export interface ParsedRosterRow {
  discordHandle: string;
  status: string;
  adaptRoleValues: string[];
}

/** Saved roster row; may carry a Discord user id after a successful reconcile. */
export interface SavedRosterRow extends ParsedRosterRow {
  discordUserId?: string;
}

export type ParseLabRosterFailureReason =
  | "roster_no_rows"
  | "invalid_row"
  | "not_recognized";

export type ParseLabRosterResult =
  | { ok: true; rows: ParsedRosterRow[]; adaptRoleValues: string[] }
  | { ok: false; reason?: ParseLabRosterFailureReason };

export interface SpacelabRememberedMember {
  discordUserId: string;
  discordHandle: string;
  grantedRoleIds?: string[];
}

export interface SpacelabReconcileFailure {
  memberKey: string;
  discordHandle: string;
  attempts: number;
}

export interface SpacelabReconcilePassMode {
  kind: "full" | "retry-failures-only";
}
