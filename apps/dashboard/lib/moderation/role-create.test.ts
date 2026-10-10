import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Permission } from "@maia/discord";
import {
  computeGuildPermissions,
  parseRoleCreateInput,
  sanitizeRolePermissions,
} from "./role-create";

describe("parseRoleCreateInput", () => {
  it("accepts minimal valid input", () => {
    const result = parseRoleCreateInput({ name: "Helper" });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.name, "Helper");
      assert.equal(result.value.hoist, false);
      assert.equal(result.value.mentionable, false);
    }
  });

  it("rejects empty name", () => {
    const result = parseRoleCreateInput({ name: "   " });
    assert.equal(result.ok, false);
  });

  it("parses hex color", () => {
    const result = parseRoleCreateInput({ name: "Blue", color: "#5865F2" });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.color, 0x5865f2);
    }
  });
});

describe("sanitizeRolePermissions", () => {
  it("defaults to zero permissions", () => {
    assert.equal(sanitizeRolePermissions(undefined, Permission.ManageRoles), "0");
  });

  it("masks requested permissions to bot permissions", () => {
    const botPerms = Permission.ViewChannel | Permission.SendMessages;
    const requested = (Permission.ViewChannel | Permission.ManageRoles).toString();
    assert.equal(
      sanitizeRolePermissions(requested, botPerms),
      Permission.ViewChannel.toString(),
    );
  });
});

describe("computeGuildPermissions", () => {
  it("combines role permissions with everyone", () => {
    const guildId = "100";
    const perms = computeGuildPermissions(
      { roles: ["200"] },
      [
        {
          id: guildId,
          name: "@everyone",
          color: 0,
          position: 0,
          managed: false,
          permissions: Permission.ViewChannel.toString(),
        },
        {
          id: "200",
          name: "Mod",
          color: 0,
          position: 1,
          managed: false,
          permissions: Permission.ManageRoles.toString(),
        },
      ],
      guildId,
    );
    assert.equal(
      (perms & Permission.ManageRoles) === Permission.ManageRoles,
      true,
    );
  });
});
