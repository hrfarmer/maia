import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_RECONCILE_MEMBER_ATTEMPTS } from "@maia/plugins";
import { buildSpacelabCycleStatusView } from "@maia/db";
import { getDevSpacelabCycleStatus } from "@/lib/dev-spacelab-cycle";
import {
  formatSpacelabLastCycleLabel,
  formatSpacelabLastErrorLabel,
  spacelabCycleMemberLists,
} from "@/lib/plugins/spacelab-cycle-display";

describe("Space Lab cycle status for Plugins card", () => {
  it("buildSpacelabCycleStatusView exposes last cycle, last error, pending, and exhausted members", async () => {
    const view = await buildSpacelabCycleStatusView(
      {
        query: {
          spacelabGuildCycleState: {
            findFirst: async () => ({
              guildId: "guild-1",
              lastCycleAt: new Date("2026-01-15T12:00:00.000Z"),
              lastError: "archive_move_failed",
              lastParsedMessageId: "msg-1",
              pendingArchiveMessageIdsJson: "[]",
              adaptLinksRevision: 0,
              lastProcessedAdaptLinksRevision: 0,
            }),
          },
          spacelabReconcileFailures: {
            findMany: async () => [
              { discordHandle: "pending.user", attempts: 2 },
              {
                discordHandle: "exhausted.user",
                attempts: MAX_RECONCILE_MEMBER_ATTEMPTS,
              },
            ],
          },
        },
      } as never,
      "guild-1",
    );

    assert.equal(view.lastCycleAt, "2026-01-15T12:00:00.000Z");
    assert.equal(view.lastError, "archive_move_failed");
    assert.deepEqual(view.pendingMembers, [{ discordHandle: "pending.user" }]);
    assert.deepEqual(view.exhaustedMembers, [
      { discordHandle: "exhausted.user" },
    ]);
  });

  it("maps cycle-status JSON to Plugins card labels and member lists", () => {
    const status = getDevSpacelabCycleStatus();
    assert.equal(
      formatSpacelabLastCycleLabel(status.lastCycleAt),
      new Date("2026-01-15T12:00:00.000Z").toLocaleString(),
    );
    assert.equal(formatSpacelabLastErrorLabel(status.lastError), "None");
    assert.deepEqual(spacelabCycleMemberLists(status), {
      pendingHandles: ["user.retry"],
      exhaustedHandles: ["user.exhausted"],
    });
  });
});
