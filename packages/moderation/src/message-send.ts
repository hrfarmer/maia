export interface ParsedMessageSend {
  content: string;
  replyToMessageId?: string;
}

const SNOWFLAKE = /^\d{17,20}$/;

export function parseMessageSendInput(
  body: unknown,
): { ok: true; value: ParsedMessageSend } | { ok: false; error: string } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const record = body as Record<string, unknown>;
  if (typeof record.content !== "string") {
    return { ok: false, error: "content is required and must be a string." };
  }
  const content = record.content;
  if (content.length === 0) {
    return { ok: false, error: "content cannot be empty." };
  }
  if (content.length > 2000) {
    return { ok: false, error: "content must be at most 2000 characters." };
  }

  let replyToMessageId: string | undefined;
  if (record.replyToMessageId !== undefined) {
    if (typeof record.replyToMessageId !== "string") {
      return {
        ok: false,
        error: "replyToMessageId must be a string when provided.",
      };
    }
    if (!SNOWFLAKE.test(record.replyToMessageId)) {
      return { ok: false, error: "replyToMessageId must be a snowflake." };
    }
    replyToMessageId = record.replyToMessageId;
  }

  return {
    ok: true,
    value: { content, replyToMessageId },
  };
}
