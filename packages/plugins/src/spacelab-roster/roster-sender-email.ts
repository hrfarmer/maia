const ROSTER_SENDER_EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeRosterSenderEmailForCompare(email: string): string {
  return email.trim().toLowerCase();
}

export function trimRosterSenderEmail(email: string): string {
  return email.trim();
}

export function isValidRosterSenderEmail(email: string): boolean {
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return false;
  }
  return ROSTER_SENDER_EMAIL_PATTERN.test(trimmed);
}

export function rosterSenderEmailMatches(
  configured: string | null | undefined,
  messageFrom: string | undefined,
): boolean {
  if (!configured || configured.trim() === "") {
    return true;
  }
  if (!messageFrom || messageFrom.trim() === "") {
    return false;
  }
  return (
    normalizeRosterSenderEmailForCompare(configured) ===
    normalizeRosterSenderEmailForCompare(messageFrom)
  );
}

export function resolveGraphMessageFromAddress(message: {
  fromEmailAddress?: string;
  senderEmailAddress?: string;
}): string | undefined {
  const from = message.fromEmailAddress?.trim();
  if (from) {
    return from;
  }
  const sender = message.senderEmailAddress?.trim();
  return sender || undefined;
}
