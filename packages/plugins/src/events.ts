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

/** Gateway events delivered in issue #19 (member and role). */
export const MEMBER_ROLE_PLUGIN_EVENTS = [
  "member.join",
  "member.leave",
  "member.update",
  "role.create",
  "role.update",
  "role.delete",
] as const satisfies readonly PluginEvent[];

export type MemberRolePluginEvent =
  (typeof MEMBER_ROLE_PLUGIN_EVENTS)[number];

const MEMBER_ROLE_PLUGIN_EVENT_SET = new Set<string>(
  MEMBER_ROLE_PLUGIN_EVENTS,
);

export function isMemberRolePluginEvent(
  value: string,
): value is MemberRolePluginEvent {
  return MEMBER_ROLE_PLUGIN_EVENT_SET.has(value);
}

/** Gateway events delivered in issue #24 (message and reaction; always-on only). */
export const MESSAGE_REACTION_PLUGIN_EVENTS = [
  "message.created",
  "reaction.added",
  "reaction.removed",
] as const satisfies readonly PluginEvent[];

export type MessageReactionPluginEvent =
  (typeof MESSAGE_REACTION_PLUGIN_EVENTS)[number];

const MESSAGE_REACTION_PLUGIN_EVENT_SET = new Set<string>(
  MESSAGE_REACTION_PLUGIN_EVENTS,
);

export function isMessageReactionPluginEvent(
  value: string,
): value is MessageReactionPluginEvent {
  return MESSAGE_REACTION_PLUGIN_EVENT_SET.has(value);
}
