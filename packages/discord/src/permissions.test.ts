import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PermissionFlagsBits } from "discord.js";
import {
  BOT_INVITE_PERMISSIONS,
  BOT_INVITE_PERMISSION_BITS,
  BOT_INVITE_PERMISSIONS_STRING,
} from "./permissions.js";

function bitIndices(value: bigint): number[] {
  const indices: number[] = [];
  for (let i = 0; i <= 50; i += 1) {
    if ((value & (1n << BigInt(i))) !== 0n) {
      indices.push(i);
    }
  }
  return indices;
}

const REQUIRED_INVITE_FLAGS =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.AddReactions |
  PermissionFlagsBits.ReadMessageHistory |
  PermissionFlagsBits.ManageMessages |
  PermissionFlagsBits.ManageRoles |
  PermissionFlagsBits.KickMembers |
  PermissionFlagsBits.BanMembers |
  PermissionFlagsBits.ModerateMembers |
  PermissionFlagsBits.ManageNicknames;

describe("BOT_INVITE_PERMISSIONS", () => {
  it("matches the OR of required PermissionFlagsBits", () => {
    assert.equal(BOT_INVITE_PERMISSIONS, REQUIRED_INVITE_FLAGS);
  });

  it("has the exact permission integer", () => {
    assert.equal(BOT_INVITE_PERMISSIONS, 1099914357830n);
    assert.equal(BOT_INVITE_PERMISSIONS_STRING, "1099914357830");
  });

  it("sets only the expected bit indices", () => {
    assert.deepEqual(bitIndices(BOT_INVITE_PERMISSIONS), [
      ...BOT_INVITE_PERMISSION_BITS,
    ]);
  });

  it("includes message moderation permissions", () => {
    assert.notEqual(
      BOT_INVITE_PERMISSIONS & PermissionFlagsBits.ReadMessageHistory,
      0n,
    );
    assert.notEqual(
      BOT_INVITE_PERMISSIONS & PermissionFlagsBits.AddReactions,
      0n,
    );
    assert.notEqual(
      BOT_INVITE_PERMISSIONS & PermissionFlagsBits.ManageMessages,
      0n,
    );
  });

  it("includes manage roles and manage nicknames", () => {
    assert.notEqual(
      BOT_INVITE_PERMISSIONS & PermissionFlagsBits.ManageRoles,
      0n,
    );
    assert.notEqual(
      BOT_INVITE_PERMISSIONS & PermissionFlagsBits.ManageNicknames,
      0n,
    );
  });
});
