const MAX_MESSAGE_LIST_LIMIT = 100;

export interface ParsedMessageListQuery {
  limit: number;
}

export function parseMessageListQuery(
  searchParams: URLSearchParams,
):
  | { ok: true; value: ParsedMessageListQuery }
  | { ok: false; error: string } {
  const raw = searchParams.get("limit");
  if (raw === null) {
    return { ok: true, value: { limit: 50 } };
  }
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1) {
    return { ok: false, error: "limit must be a positive integer." };
  }
  if (limit > MAX_MESSAGE_LIST_LIMIT) {
    return {
      ok: false,
      error: `limit must be at most ${MAX_MESSAGE_LIST_LIMIT}.`,
    };
  }
  return { ok: true, value: { limit } };
}

export { MAX_MESSAGE_LIST_LIMIT };
