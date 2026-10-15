import type { ParsedRosterRow, ParseLabRosterResult } from "./types.js";

class RosterParseError extends Error {
  readonly tag = "RosterParseError";
  readonly fieldIndex?: number;
  readonly recordIndex?: number;
  readonly pos?: number;

  constructor(
    message: string,
    details?: { fieldIndex?: number; recordIndex?: number; pos?: number },
  ) {
    super(message);
    this.fieldIndex = details?.fieldIndex;
    this.recordIndex = details?.recordIndex;
    this.pos = details?.pos;
  }
}

function charClassAt(text: string, pos: number): string {
  if (pos < 0 || pos >= text.length) {
    return "eof";
  }
  const char = text[pos]!;
  if (char === ",") {
    return "comma";
  }
  if (char === '"') {
    return "quote";
  }
  if (char === "\n") {
    return "lf";
  }
  if (char === "\r") {
    return "cr";
  }
  if (char === " " || char === "\t") {
    return "space";
  }
  return "other";
}

function failureCharContext(text: string, pos: number | undefined) {
  if (pos === undefined) {
    return { at: null, before: null, after: null };
  }
  return {
    at: charClassAt(text, pos),
    before: charClassAt(text, pos - 1),
    after: charClassAt(text, pos + 1),
  };
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

function detectDelimiter(headerLine: string): "\t" | "," {
  if (headerLine.includes("\t")) {
    return "\t";
  }
  return ",";
}

function isWhitespace(char: string): boolean {
  return char === " " || char === "\t" || char === "\n" || char === "\f" || char === "\v";
}

function skipWhitespace(text: string, pos: number): number {
  while (pos < text.length && isWhitespace(text[pos]!)) {
    pos += 1;
  }
  return pos;
}

function readCommaSeparatedField(
  text: string,
  pos: number,
  options?: { lastFieldInRecord?: boolean },
): { field: string; nextPos: number } {
  if (pos >= text.length) {
    return { field: "", nextPos: pos };
  }
  if (text[pos] === '"') {
    let field = "";
    let index = pos + 1;
    while (index < text.length) {
      const char = text[index]!;
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        index += 1;
        break;
      }
      field += char;
      index += 1;
    }
    return { field, nextPos: index };
  }
  let field = "";
  let index = pos;
  while (index < text.length) {
    const char = text[index]!;
    if (char === "," || char === "\n") {
      break;
    }
    if (options?.lastFieldInRecord && isWhitespace(char)) {
      break;
    }
    field += char;
    index += 1;
  }
  return { field, nextPos: index };
}

function readCommaRecord(
  text: string,
  startPos: number,
  fieldCount: number | "header",
  recordIndex?: number,
): { fields: string[]; nextPos: number } {
  let pos = startPos;
  const fields: string[] = [];
  const recordComplete = () =>
    fieldCount !== "header" && fields.length >= fieldCount;

  const throwParseError = (message: string, fieldIndex: number) => {
    throw new RosterParseError(message, { fieldIndex, recordIndex, pos });
  };

  while (true) {
    if (recordComplete()) {
      break;
    }
    const isLastFieldInRecord =
      fieldCount !== "header" && fields.length === fieldCount - 1;
    if (!isLastFieldInRecord) {
      pos = skipWhitespace(text, pos);
    }
    if (pos >= text.length) {
      if (isLastFieldInRecord) {
        fields.push("");
      }
      break;
    }
    if (isLastFieldInRecord && isWhitespace(text[pos]!)) {
      fields.push("");
    } else {
      const { field, nextPos } = readCommaSeparatedField(text, pos, {
        lastFieldInRecord: isLastFieldInRecord,
      });
      fields.push(field.trim());
      pos = nextPos;
    }
    if (pos >= text.length) {
      break;
    }
    if (recordComplete() || fieldCount === "header") {
      if (isWhitespace(text[pos]!)) {
        pos = skipWhitespace(text, pos);
        break;
      }
      if (fieldCount === "header" && text[pos] === ",") {
        pos += 1;
        continue;
      }
      if (recordComplete()) {
        break;
      }
    }

    if (text[pos] === ",") {
      pos += 1;
      continue;
    }

    if (isWhitespace(text[pos]!)) {
      const wsStart = pos;
      const afterWs = skipWhitespace(text, pos);
      if (afterWs >= text.length) {
        pos = afterWs;
        break;
      }
      if (text[afterWs] === ",") {
        pos = afterWs + 1;
        continue;
      }
      if (text[afterWs] === '"') {
        pos = afterWs;
        continue;
      }
      if (recordComplete()) {
        pos = afterWs;
        break;
      }
      const fieldIndex = fields.length - 1;
      const continued = readCommaSeparatedField(text, afterWs, {
        lastFieldInRecord: isLastFieldInRecord,
      });
      fields[fieldIndex] =
        `${fields[fieldIndex] ?? ""}${continued.field}`.trim();
      pos = continued.nextPos;
      if (pos < text.length && text[pos] === ",") {
        pos += 1;
      }
      continue;
    }

    throwParseError("Malformed CSV record", fields.length);
  }
  return { fields, nextPos: pos };
}

function splitCsvRow(line: string): string[] {
  const fields: string[] = [];
  let pos = 0;
  while (pos < line.length) {
    const { field, nextPos } = readCommaSeparatedField(line, pos);
    fields.push(field);
    pos = nextPos;
    if (pos >= line.length) {
      break;
    }
    if (line[pos] === ",") {
      pos += 1;
      continue;
    }
    break;
  }
  return fields;
}

function splitRow(line: string, delimiter: "\t" | ","): string[] {
  if (delimiter === "\t") {
    return line.split("\t");
  }
  return splitCsvRow(line);
}

interface LabRosterTable {
  headers: string[];
  records: string[][];
}

function splitMessageLines(message: string): string[] {
  const normalized = normalizeLabRosterMessageBody(message);
  if (normalized === "") {
    return [];
  }
  return normalized.split("\n");
}

function parseTabDelimitedTable(message: string): LabRosterTable | null {
  const lines = splitMessageLines(message);
  if (lines.length === 0) {
    return null;
  }
  const delimiter = detectDelimiter(lines[0]!);
  if (delimiter !== "\t") {
    return null;
  }
  const headers = splitRow(lines[0]!, delimiter).map((cell) => cell.trim());
  const records: string[][] = [];
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!;
    if (line.trim() === "") {
      continue;
    }
    records.push(splitRow(line, delimiter).map((cell) => cell.trim()));
  }
  return { headers, records };
}

function readUnquotedHeaderField(
  text: string,
  pos: number,
): { field: string; nextPos: number } {
  let field = "";
  let index = pos;
  while (
    index < text.length &&
    text[index] !== "," &&
    text[index] !== " " &&
    text[index] !== "\n"
  ) {
    field += text[index]!;
    index += 1;
  }
  return { field, nextPos: index };
}

function readUnquotedHeaderFields(
  text: string,
  startPos: number,
): { headers: string[]; nextPos: number } {
  const fields: string[] = [];
  let pos = startPos;
  while (pos < text.length) {
    pos = skipWhitespace(text, pos);
    if (pos >= text.length) {
      break;
    }
    if (text[pos] === '"') {
      break;
    }
    const { field, nextPos } = readUnquotedHeaderField(text, pos);
    fields.push(field.trim());
    pos = nextPos;
    if (pos >= text.length) {
      break;
    }
    const nextChar = text[pos]!;
    if (nextChar === ",") {
      pos += 1;
      continue;
    }
    if (isWhitespace(nextChar)) {
      pos = skipWhitespace(text, pos);
      break;
    }
    break;
  }
  return { headers: fields, nextPos: pos };
}

function readHeaderCommaField(
  text: string,
  pos: number,
): { field: string; nextPos: number } {
  let field = "";
  let index = pos;
  while (index < text.length) {
    const char = text[index]!;
    if (char === "," || char === " " || char === "\n") {
      break;
    }
    field += char;
    index += 1;
  }
  return { field, nextPos: index };
}

function readCommaHeaderRecord(
  text: string,
  startPos: number,
): { headers: string[]; nextPos: number } {
  let pos = startPos;
  const fields: string[] = [];
  while (true) {
    pos = skipWhitespace(text, pos);
    if (pos >= text.length) {
      break;
    }
    const { field, nextPos } = readHeaderCommaField(text, pos);
    if (field === "" && nextPos < text.length && text[nextPos] === ",") {
      pos = nextPos + 1;
      continue;
    }
    fields.push(field.trim());
    pos = nextPos;
    if (pos >= text.length) {
      break;
    }
    if (text[pos] === ",") {
      pos += 1;
      continue;
    }
    if (isWhitespace(text[pos]!)) {
      const wsStart = pos;
      const afterWs = skipWhitespace(text, pos);
      if (afterWs >= text.length) {
        pos = afterWs;
        break;
      }
      if (text[afterWs] === ",") {
        pos = afterWs + 1;
        continue;
      }
      if (text[afterWs] === '"') {
        pos = afterWs;
        break;
      }
      const fieldIndex = fields.length - 1;
      const continued = readHeaderCommaField(text, afterWs);
      fields[fieldIndex] =
        `${fields[fieldIndex] ?? ""}${continued.field}`.trim();
      pos = continued.nextPos;
      continue;
    }
    break;
  }
  return { headers: fields, nextPos: pos };
}

function parseCommaDelimitedTable(message: string): LabRosterTable | null {
  const normalized = normalizeLabRosterMessageBody(message);
  if (normalized === "") {
    return null;
  }
  if (detectDelimiter(normalized.slice(0, 512)) !== ",") {
    return null;
  }

  const headerRecord = readCommaHeaderRecord(normalized, 0);
  const headers = headerRecord.headers;
  const dataStartPos = headerRecord.nextPos;

  if (headers.length === 0) {
    return null;
  }
  const fieldCount = headers.length;
  const records: string[][] = [];
  let pos = dataStartPos;
  let recordIndex = 0;
  while (pos < normalized.length) {
    pos = skipWhitespace(normalized, pos);
    if (pos >= normalized.length) {
      break;
    }
    const record = readCommaRecord(normalized, pos, fieldCount, recordIndex);
    if (record.fields.length === 0) {
      break;
    }
    if (record.fields.length !== fieldCount) {
      const tailPos = skipWhitespace(normalized, record.nextPos);
      if (record.fields.length < fieldCount && tailPos >= normalized.length) {
        break;
      }
      throw new RosterParseError("Wrong field count in roster row", {
        fieldIndex: record.fields.length,
        recordIndex,
        pos,
      });
    }
    records.push(record.fields);
    pos = record.nextPos;
    recordIndex += 1;
  }
  return { headers, records };
}

/** @internal Exported for wrap-injection tests only. */
export function parseLabRosterTableForTests(message: string): LabRosterTable | null {
  return parseLabRosterTable(message);
}

/** @internal Exported for wrap-injection tests only. */
export function readCommaHeaderRecordForTests(
  text: string,
  startPos: number,
): { headers: string[]; nextPos: number } {
  return readCommaHeaderRecord(text, startPos);
}

function parseLabRosterTable(message: string): LabRosterTable | null {
  const normalized = normalizeLabRosterMessageBody(message);
  if (normalized === "") {
    return null;
  }
  const firstLineBreak = normalized.indexOf("\n");
  const headerProbe =
    firstLineBreak === -1 ? normalized : normalized.slice(0, firstLineBreak);
  const delimiter = detectDelimiter(headerProbe);
  if (delimiter === "\t") {
    return parseTabDelimitedTable(message);
  }
  return parseCommaDelimitedTable(message);
}

function parseHeaderColumns(headerLine: string): string[] {
  const delimiter = detectDelimiter(headerLine);
  return splitRow(headerLine, delimiter).map((cell) => cell.trim());
}

export function labRosterExportHeaders(message: string): string[] | null {
  const table = parseLabRosterTable(message);
  return table?.headers ?? null;
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

function parseStatusCell(cell: string): string {
  const trimmed = cell.trim();
  if (trimmed === "") {
    return "";
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const values = parseLookupCellValues(trimmed);
    if (values.length !== 1) {
      throw new RosterParseError("Invalid status lookup cell");
    }
    return values[0]!;
  }
  return trimmed;
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

export interface LabRosterParseStats {
  headerColumnCount: number;
  recordCount: number;
  skipped_missing_discord_handle: number;
  skipped_missing_status: number;
  rejectedRowReasons: {
    missing_title: number;
    missing_member: number;
    missing_github_handle: number;
    missing_txst_email: number;
  };
}

function emptyRejectedRowReasons(): LabRosterParseStats["rejectedRowReasons"] {
  return {
    missing_title: 0,
    missing_member: 0,
    missing_github_handle: 0,
    missing_txst_email: 0,
  };
}

function emptyParseStats(
  headerColumnCount: number,
  recordCount: number,
): LabRosterParseStats {
  return {
    headerColumnCount,
    recordCount,
    skipped_missing_discord_handle: 0,
    skipped_missing_status: 0,
    rejectedRowReasons: emptyRejectedRowReasons(),
  };
}

export function logLabRosterParseStructure(
  stats: LabRosterParseStats,
  failure?: {
    fieldIndex?: number;
    recordIndex?: number;
    reason: string;
    pos?: number;
    sourceText?: string;
  },
) {
  const charContext =
    failure?.sourceText !== undefined
      ? failureCharContext(failure.sourceText, failure.pos)
      : undefined;
  console.log(
    JSON.stringify({
      spacelabRosterParse: {
        headerColumnCount: stats.headerColumnCount,
        recordCount: stats.recordCount,
        skipped_missing_discord_handle: stats.skipped_missing_discord_handle,
        skipped_missing_status: stats.skipped_missing_status,
        rejectedRowReasons: stats.rejectedRowReasons,
        ...(failure
          ? {
              failureFieldIndex: failure.fieldIndex ?? null,
              failureRecordIndex: failure.recordIndex ?? null,
              failureReason: failure.reason,
              failureCharAt: charContext?.at ?? null,
              failureCharBefore: charContext?.before ?? null,
              failureCharAfter: charContext?.after ?? null,
            }
          : {}),
      },
    }),
  );
}

function noteRejectedIdentityFields(
  cells: string[],
  headers: string[],
  rejected: LabRosterParseStats["rejectedRowReasons"],
) {
  const noteEmpty = (column: string, key: keyof typeof rejected) => {
    const index = headers.indexOf(column);
    if (index < 0) {
      return;
    }
    if ((cells[index] ?? "").trim() === "") {
      rejected[key] += 1;
    }
  };
  noteEmpty("Title", "missing_title");
  noteEmpty("Member", "missing_member");
  noteEmpty("GitHubHandle", "missing_github_handle");
  noteEmpty("TXSTEmail", "missing_txst_email");
}

export function parseLabRosterMessage(
  message: string,
  rosterColumn: string,
): ParseLabRosterResult {
  if (!isLabRosterExportMessage(message, rosterColumn)) {
    return { ok: false, reason: "not_recognized" };
  }

  let table: LabRosterTable | null;
  const normalizedForFailure = normalizeLabRosterMessageBody(message);
  try {
    table = parseLabRosterTable(message);
  } catch (error) {
    if (error instanceof RosterParseError) {
      logLabRosterParseStructure(emptyParseStats(0, 0), {
        fieldIndex: error.fieldIndex,
        recordIndex: error.recordIndex,
        reason: error.message,
        pos: error.pos,
        sourceText: normalizedForFailure,
      });
      return { ok: false, reason: "invalid_row" };
    }
    throw error;
  }
  if (!table) {
    return { ok: false, reason: "not_recognized" };
  }

  const headers = table.headers;
  const handleIndex = headers.indexOf("DiscordHandle");
  const statusIndex = headers.indexOf("Status");
  const rosterIndex = headers.indexOf(rosterColumn);
  if (handleIndex < 0 || statusIndex < 0 || rosterIndex < 0) {
    return { ok: false, reason: "not_recognized" };
  }

  const stats = emptyParseStats(headers.length, table.records.length);

  if (table.records.length === 0) {
    logLabRosterParseStructure(stats);
    return { ok: false, reason: "roster_no_rows" };
  }

  const parsedRows: ParsedRosterRow[] = [];
  try {
    for (const cells of table.records) {
      const discordHandle = (cells[handleIndex] ?? "").trim();
      if (discordHandle === "") {
        stats.skipped_missing_discord_handle += 1;
        continue;
      }
      const status = parseStatusCell(cells[statusIndex] ?? "");
      if (status === "") {
        stats.skipped_missing_status += 1;
        continue;
      }
      noteRejectedIdentityFields(cells, headers, stats.rejectedRowReasons);
      const adaptRoleValues = parseLookupCellValues(cells[rosterIndex] ?? "");
      parsedRows.push({ discordHandle, status, adaptRoleValues });
    }
  } catch (error) {
    logLabRosterParseStructure(stats);
    if (error instanceof RosterParseError) {
      return { ok: false, reason: "invalid_row" };
    }
    throw error;
  }

  if (parsedRows.length === 0) {
    logLabRosterParseStructure(stats);
    return { ok: false, reason: "roster_no_rows" };
  }

  logLabRosterParseStructure(stats);
  const rows = mergeRows(parsedRows);
  return { ok: true, rows, adaptRoleValues: distinctAdaptValues(rows) };
}

export function rosterStatusIsActive(status: string): boolean {
  return status.localeCompare("Active", undefined, { sensitivity: "accent" }) ===
    0;
}
