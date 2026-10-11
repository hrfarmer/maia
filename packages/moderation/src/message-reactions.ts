const SNOWFLAKE = /^\d{17,20}$/;

export function parseReactionEmoji(raw: string): { ok: true; emoji: string } | { ok: false; error: string } {
  let emoji: string;
  try {
    emoji = decodeURIComponent(raw);
  } catch {
    return { ok: false, error: "emoji must be URL-encoded." };
  }
  if (emoji.length === 0) {
    return { ok: false, error: "emoji is required." };
  }
  if (emoji.length > 256) {
    return { ok: false, error: "emoji is too long." };
  }
  return { ok: true, emoji };
}

export function parseReactionRemoveQuery(
  searchParams: URLSearchParams,
):
  | { ok: true; value: { userId?: string } }
  | { ok: false; error: string } {
  const raw = searchParams.get("userId");
  if (raw === null) {
    return { ok: true, value: {} };
  }
  if (!SNOWFLAKE.test(raw)) {
    return { ok: false, error: "userId must be a snowflake when provided." };
  }
  return { ok: true, value: { userId: raw } };
}
