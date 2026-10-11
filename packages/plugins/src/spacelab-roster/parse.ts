import type { ParsedRosterRow, ParseLabRosterResult } from "./types.js";

class RosterParseError extends Error {
  readonly tag = "RosterParseError";
}

function splitMessageLines(message: string): string[] {
  const normalized = message.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (normalized === "") {
    return [];
  }
  return normalized.split("\n");
}

function splitRow(line: string): string[] {
  return line.split("\t");
}

function parseHeaderColumns(headerLine: string): string[] {
  return splitRow(headerLine).map((cell) => cell.trim());
}

export function labRosterExportHeaders(message: string): string[] | null {
  const lines = splitMessageLines(message);
  if (lines.length === 0) {
    return null;
  }
  return parseHeaderColumns(lines[0]!);
}

export function isLabRosterExportMessage(
  message: string,
  rosterColumn: string,
): boolean {
  const headers = labRosterExportHeaders(message);
  if (!headers) {
    return false;
  }
  const headerSet = new Set(headers);
  return (
    headerSet.has("DiscordHandle") &&
    headerSet.has("Status") &&
    headerSet.has(rosterColumn)
  );
}

function parseLookupCellValues(cell: string): string[] {
  const trimmed = cell.trim();
  if (trimmed === "") {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new RosterParseError("Invalid lookup JSON");
  }
  if (Array.isArray(parsed)) {
    const values: string[] = [];
    for (const item of parsed) {
      if (
        !item ||
        typeof item !== "object" ||
        typeof (item as { Value?: unknown }).Value !== "string"
      ) {
        throw new RosterParseError("Invalid lookup collection item");
      }
      values.push((item as { Value: string }).Value);
    }
    return values;
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    typeof (parsed as { Value?: unknown }).Value === "string"
  ) {
    return [(parsed as { Value: string }).Value];
  }
  throw new RosterParseError("Invalid lookup cell");
}

function mergeRows(rows: ParsedRosterRow[]): ParsedRosterRow[] {
  const byHandle = new Map<string, ParsedRosterRow>();
  for (const row of rows) {
    const key = row.discordHandle.toLowerCase();
    const existing = byHandle.get(key);
    if (!existing) {
      byHandle.set(key, {
        discordHandle: row.discordHandle,
        status: row.status,
        adaptRoleValues: [...row.adaptRoleValues],
      });
      continue;
    }
    const valueSet = new Set(existing.adaptRoleValues);
    for (const value of row.adaptRoleValues) {
      valueSet.add(value);
    }
    byHandle.set(key, {
      discordHandle: existing.discordHandle,
      status: row.status,
      adaptRoleValues: [...valueSet],
    });
  }
  return [...byHandle.values()];
}

function distinctAdaptValues(rows: ParsedRosterRow[]): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    for (const value of row.adaptRoleValues) {
      values.add(value);
    }
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

export function parseLabRosterMessage(
  message: string,
  rosterColumn: string,
): ParseLabRosterResult {
  if (!isLabRosterExportMessage(message, rosterColumn)) {
    return { ok: false };
  }

  const lines = splitMessageLines(message);
  const headers = parseHeaderColumns(lines[0]!);
  const handleIndex = headers.indexOf("DiscordHandle");
  const statusIndex = headers.indexOf("Status");
  const rosterIndex = headers.indexOf(rosterColumn);
  if (handleIndex < 0 || statusIndex < 0 || rosterIndex < 0) {
    return { ok: false };
  }

  const parsedRows: ParsedRosterRow[] = [];
  try {
    for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex]!;
      if (line.trim() === "") {
        continue;
      }
      const cells = splitRow(line);
      const discordHandle = (cells[handleIndex] ?? "").trim();
      const status = (cells[statusIndex] ?? "").trim();
      if (discordHandle === "" || status === "") {
        throw new RosterParseError("Missing handle or status");
      }
      const adaptRoleValues = parseLookupCellValues(cells[rosterIndex] ?? "");
      parsedRows.push({ discordHandle, status, adaptRoleValues });
    }
  } catch (error) {
    if (error instanceof RosterParseError) {
      return { ok: false };
    }
    throw error;
  }

  const rows = mergeRows(parsedRows);
  return { ok: true, rows, adaptRoleValues: distinctAdaptValues(rows) };
}

export function rosterStatusIsActive(status: string): boolean {
  return status.localeCompare("Active", undefined, { sensitivity: "accent" }) ===
    0;
}
