export const PLUGIN_EVENTS = [
  "member.join",
  "member.leave",
  "member.update",
  "role.create",
  "role.update",
  "role.delete",
  "message.created",
  "reaction.added",
  "reaction.removed",
] as const;

export type PluginEvent = (typeof PLUGIN_EVENTS)[number];

export const PLUGIN_EVENT_SET = new Set<string>(PLUGIN_EVENTS);

/** Invocation plugins may not subscribe to these events. */
export const INVOCATION_FORBIDDEN_EVENTS = new Set<string>([
  "message.created",
  "reaction.added",
  "reaction.removed",
]);

export function isKnownPluginEvent(value: string): value is PluginEvent {
  return PLUGIN_EVENT_SET.has(value);
}
