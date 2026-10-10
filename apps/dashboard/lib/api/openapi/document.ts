import {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from "../../rate-limit";

const snowflakePattern = "^\\d{17,20}$";

const errorResponse = {
  description: "Error message",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
} as const;

const authErrorResponses = {
  "401": errorResponse,
  "403": errorResponse,
  "429": {
    description: "Rate limit exceeded",
    headers: {
      "Retry-After": {
        description: "Seconds until the current window resets",
        schema: { type: "integer", minimum: 1 },
      },
    },
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/Error" },
      },
    },
  },
} as const;

function guildIdParam() {
  return {
    name: "guildId",
    in: "path" as const,
    required: true,
    description: "Discord guild (server) ID",
    schema: { type: "string", pattern: snowflakePattern },
  };
}

function userIdParam() {
  return {
    name: "userId",
    in: "path" as const,
    required: true,
    description: "Discord user ID",
    schema: { type: "string", pattern: snowflakePattern },
  };
}

function roleIdParam() {
  return {
    name: "roleId",
    in: "path" as const,
    required: true,
    description: "Discord role ID",
    schema: { type: "string", pattern: snowflakePattern },
  };
}

function operationResponses(extra: Record<string, unknown> = {}) {
  return {
    ...authErrorResponses,
    "400": errorResponse,
    "500": errorResponse,
    ...extra,
  };
}

const rateLimitDescription = `Requests are limited to ${RATE_LIMIT_MAX_REQUESTS} per ${RATE_LIMIT_WINDOW_MS / 1000} seconds per API key. When exceeded, the API responds with \`429\` and a \`Retry-After\` header (seconds).`;

export function buildOpenApiDocument(serverUrl: string) {
  const basePath = "/api/v1/guilds/{guildId}";

  return {
    openapi: "3.1.0",
    info: {
      title: "Maia External API",
      version: "1.0.0",
      description: [
        "Authenticated REST endpoints on the Maia dashboard origin. Actions run through the bot with Discord permissions and role hierarchy checks, and are recorded in the server audit log.",
        "",
        "### Authentication",
        "Create a per-guild API key on the server detail page (**API keys** tab). Each key is scoped to exactly one guild. The raw token is shown once on creation (`maia_…`).",
        "",
        "Send `Authorization: Bearer maia_…` on every request.",
        "",
        rateLimitDescription,
      ].join("\n"),
    },
    servers: [{ url: serverUrl.replace(/\/$/, "") }],
    tags: [
      { name: "Roles", description: "Guild roles and member role assignments" },
      { name: "Members", description: "Kick, ban, timeout, and nickname" },
      { name: "Bans", description: "Remove guild bans" },
    ],
    security: [{ bearerAuth: [] }],
    paths: {
      [`${basePath}/roles`]: {
        get: {
          tags: ["Roles"],
          summary: "List guild roles",
          description:
            "Returns assignable guild roles (excluding @everyone), highest position first.",
          parameters: [guildIdParam()],
          responses: operationResponses({
            "200": {
              description: "Guild roles",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/RoleListResponse" },
                },
              },
            },
          }),
        },
        post: {
          tags: ["Roles"],
          summary: "Create a guild role",
          parameters: [guildIdParam()],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RoleCreateRequest" },
              },
            },
          },
          responses: operationResponses({
            "201": {
              description: "Role created",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/RoleCreateResponse" },
                },
              },
            },
          }),
        },
      },
      [`${basePath}/members/{userId}/roles`]: {
        get: {
          tags: ["Roles"],
          summary: "List a member's role IDs",
          parameters: [guildIdParam(), userIdParam()],
          responses: operationResponses({
            "200": {
              description: "Member role IDs",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/MemberRolesResponse",
                  },
                },
              },
            },
          }),
        },
        put: {
          tags: ["Roles"],
          summary: "Set a member's roles",
          description:
            "Replaces the member's roles with the given list (managed roles and @everyone are not included).",
          parameters: [guildIdParam(), userIdParam()],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SetMemberRolesRequest" },
              },
            },
          },
          responses: operationResponses({
            "200": {
              description: "Roles updated",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/OkResponse" },
                },
              },
            },
          }),
        },
      },
      [`${basePath}/members/{userId}/roles/{roleId}`]: {
        put: {
          tags: ["Roles"],
          summary: "Add a role to a member",
          description: "Idempotent if the member already has the role.",
          parameters: [guildIdParam(), userIdParam(), roleIdParam()],
          responses: operationResponses({
            "200": {
              description: "Role added or already present",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/OkNoopResponse" },
                },
              },
            },
          }),
        },
        delete: {
          tags: ["Roles"],
          summary: "Remove a role from a member",
          description: "Idempotent if the member does not have the role.",
          parameters: [guildIdParam(), userIdParam(), roleIdParam()],
          responses: operationResponses({
            "200": {
              description: "Role removed or already absent",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/OkNoopResponse" },
                },
              },
            },
          }),
        },
      },
      [`${basePath}/members/{userId}/kick`]: {
        post: {
          tags: ["Members"],
          summary: "Kick a member",
          parameters: [guildIdParam(), userIdParam()],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ModerationReasonRequest" },
              },
            },
          },
          responses: operationResponses({
            "200": {
              description: "Member kicked",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/OkResponse" },
                },
              },
            },
          }),
        },
      },
      [`${basePath}/members/{userId}/ban`]: {
        post: {
          tags: ["Members"],
          summary: "Ban a member",
          parameters: [guildIdParam(), userIdParam()],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ModerationReasonRequest" },
              },
            },
          },
          responses: operationResponses({
            "200": {
              description: "Member banned",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/OkResponse" },
                },
              },
            },
          }),
        },
      },
      [`${basePath}/bans/{userId}`]: {
        delete: {
          tags: ["Bans"],
          summary: "Unban a user",
          description: "Idempotent if the user is not banned.",
          parameters: [guildIdParam(), userIdParam()],
          responses: operationResponses({
            "200": {
              description: "User unbanned or not banned",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/OkNoopResponse" },
                },
              },
            },
          }),
        },
      },
      [`${basePath}/members/{userId}/timeout`]: {
        post: {
          tags: ["Members"],
          summary: "Timeout a member",
          parameters: [guildIdParam(), userIdParam()],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TimeoutRequest" },
              },
            },
          },
          responses: operationResponses({
            "200": {
              description: "Member timed out",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/TimeoutResponse" },
                },
              },
            },
          }),
        },
        delete: {
          tags: ["Members"],
          summary: "Remove a member timeout",
          parameters: [guildIdParam(), userIdParam()],
          responses: operationResponses({
            "200": {
              description: "Timeout cleared or not active",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/OkNoopResponse" },
                },
              },
            },
          }),
        },
      },
      [`${basePath}/members/{userId}/nickname`]: {
        patch: {
          tags: ["Members"],
          summary: "Set or clear a member nickname",
          parameters: [guildIdParam(), userIdParam()],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/NicknameRequest" },
              },
            },
          },
          responses: operationResponses({
            "200": {
              description: "Nickname updated",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/OkResponse" },
                },
              },
            },
          }),
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API key",
          description:
            "Per-guild API key from the dashboard (**API keys** tab). Token format: `maia_…`.",
        },
      },
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: { type: "string" },
          },
          additionalProperties: false,
        },
        GuildRole: {
          type: "object",
          required: ["id", "name", "color", "managed", "position"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            color: {
              type: "integer",
              description: "RGB color as a decimal integer",
            },
            managed: { type: "boolean" },
            position: { type: "integer" },
          },
          additionalProperties: false,
        },
        GuildRoleDetailed: {
          allOf: [
            { $ref: "#/components/schemas/GuildRole" },
            {
              type: "object",
              required: ["hoist", "mentionable"],
              properties: {
                hoist: { type: "boolean" },
                mentionable: { type: "boolean" },
              },
            },
          ],
        },
        RoleListResponse: {
          type: "object",
          required: ["roles"],
          properties: {
            roles: {
              type: "array",
              items: { $ref: "#/components/schemas/GuildRole" },
            },
          },
          additionalProperties: false,
        },
        RoleCreateRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            color: {
              oneOf: [
                {
                  type: "string",
                  description: "Hex color such as `#5865F2`",
                  pattern: "^#?[0-9a-fA-F]{6}$",
                },
                {
                  type: "integer",
                  minimum: 0,
                  description: "RGB color as a decimal integer",
                },
              ],
            },
            hoist: { type: "boolean", default: false },
            mentionable: { type: "boolean", default: false },
            permissions: {
              type: "string",
              pattern: "^\\d+$",
              description:
                "Discord permission bitfield as a numeric string; capped to the bot's permissions",
            },
          },
          additionalProperties: false,
        },
        RoleCreateResponse: {
          type: "object",
          required: ["ok", "role"],
          properties: {
            ok: { type: "boolean", const: true },
            role: { $ref: "#/components/schemas/GuildRoleDetailed" },
          },
          additionalProperties: false,
        },
        MemberRolesResponse: {
          type: "object",
          required: ["userId", "roleIds"],
          properties: {
            userId: { type: "string" },
            roleIds: {
              type: "array",
              items: { type: "string" },
            },
          },
          additionalProperties: false,
        },
        SetMemberRolesRequest: {
          type: "object",
          required: ["roleIds"],
          properties: {
            roleIds: {
              type: "array",
              items: { type: "string" },
            },
          },
          additionalProperties: false,
        },
        ModerationReasonRequest: {
          type: "object",
          properties: {
            reason: { type: "string" },
          },
          additionalProperties: false,
        },
        TimeoutRequest: {
          type: "object",
          required: ["minutes"],
          properties: {
            minutes: { type: "integer", minimum: 1, maximum: 40320 },
            reason: { type: "string" },
          },
          additionalProperties: false,
        },
        NicknameRequest: {
          type: "object",
          required: ["nickname"],
          properties: {
            nickname: {
              oneOf: [
                { type: "string" },
                { type: "null", description: "Clear the nickname" },
              ],
              description:
                "Server nickname. Empty strings are treated as clearing the nickname.",
            },
          },
          additionalProperties: false,
        },
        OkResponse: {
          type: "object",
          required: ["ok"],
          properties: {
            ok: { type: "boolean", const: true },
          },
          additionalProperties: false,
        },
        OkNoopResponse: {
          type: "object",
          required: ["ok"],
          properties: {
            ok: { type: "boolean", const: true },
            noop: {
              type: "boolean",
              description: "True when the action was already satisfied",
            },
          },
          additionalProperties: false,
        },
        TimeoutResponse: {
          type: "object",
          required: ["ok", "until"],
          properties: {
            ok: { type: "boolean", const: true },
            until: {
              type: "string",
              format: "date-time",
              description: "ISO 8601 timeout end time",
            },
          },
          additionalProperties: false,
        },
      },
    },
  };
}

export function listOpenApiPathOperations(
  document: ReturnType<typeof buildOpenApiDocument>,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [pathKey, item] of Object.entries(document.paths)) {
    const methods = new Set<string>();
    for (const method of [
      "get",
      "post",
      "put",
      "patch",
      "delete",
      "options",
      "head",
    ] as const) {
      if (item && typeof item === "object" && method in item) {
        methods.add(method.toUpperCase());
      }
    }
    map.set(pathKey, methods);
  }
  return map;
}
