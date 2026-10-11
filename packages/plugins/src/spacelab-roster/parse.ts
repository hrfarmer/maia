import type { ParsedRosterRow, ParseLabRosterResult } from "./types.js";

class RosterParseError extends Error {
  readonly tag = "RosterParseError";
}

function stripUtf8Bom(message: string): string {
  return message.charCodeAt(0) === 0xfeff ? message.slice(1) : message;
}

function htmlToPlainText(html: string): string {
  let text = html;
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/tr>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
  return text;
}

export function normalizeLabRosterMessageBody(message: string): string {
  let normalized = stripUtf8Bom(message);
  const trimmedStart = normalized.trimStart();
  if (/^</.test(trimmedStart)) {
    normalized = htmlToPlainText(normalized);
  }
  return normalized.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function splitMessageLines(message: string): string[] {
  const normalized = normalizeLabRosterMessageBody(message);
  if (normalized === "") {
    return [];
  }
  return normalized.split("\n");
}

function detectDelimiter(headerLine: string): "\t" | "," {
  if (headerLine.includes("\t")) {
    return "\t";
  }
  return ",";
}

function splitCsvRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function splitRow(line: string, delimiter: "\t" | ","): string[] {
  if (delimiter === "\t") {
    return line.split("\t");
  }
  return splitCsvRow(line);
}

function parseHeaderColumns(headerLine: string): string[] {
  const delimiter = detectDelimiter(headerLine);
  return splitRow(headerLine, delimiter).map((cell) => cell.trim());
}

function rowCells(line: string, delimiter: "\t" | ","): string[] {
  return splitRow(line, delimiter).map((cell) => cell.trim());
}

export function labRosterExportHeaders(message: string): string[] | null {
  const lines = splitMessageLines(message);
  if (lines.length === 0) {
    return null;
  }
  return parseHeaderColumns(lines[0]!);
}

export function labRosterNotRecognizedReason(
  message: string,
  rosterColumn: string,
): string | null {
  const raw = stripUtf8Bom(message);
  const trimmedStart = raw.trimStart();
  if (trimmedStart === "") {
    return "empty_body";
  }
  const looksHtml = /^</.test(trimmedStart);
  const normalizedMessage = normalizeLabRosterMessageBody(raw);
  if (normalizedMessage === "") {
    return looksHtml ? "html_body" : "empty_body";
  }
  const headers = labRosterExportHeaders(normalizedMessage);
  if (!headers) {
    return looksHtml ? "html_body" : "empty_body";
  }
  const headerSet = new Set(headers);
  if (!headerSet.has("DiscordHandle")) {
    if (looksHtml && !normalizedMessage.includes("DiscordHandle")) {
      return "html_body";
    }
    return "missing_header DiscordHandle";
  }
  if (!headerSet.has("Status")) {
    return "missing_header Status";
  }
  if (!headerSet.has(rosterColumn)) {
    return `column_missing ${rosterColumn}`;
  }
  return null;
}

export function isLabRosterExportMessage(
  message: string,
  rosterColumn: string,
): boolean {
  return labRosterNotRecognizedReason(message, rosterColumn) === null;
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
  const headerLine = lines[0]!;
  const delimiter = detectDelimiter(headerLine);
  const headers = parseHeaderColumns(headerLine);
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
      const cells = rowCells(line, delimiter);
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
