import { SlashCommandBuilder, time } from "discord.js";
import { getDb } from "@maia/db";
import {
  assertBotPermission,
  assertInvokerPermission,
  assertMemberManageable,
  getBotMember,
  Perm,
  requireGuild,
  requireMember,
} from "../lib/guards.js";
import { isUserFacingError, userFacingError } from "../lib/errors.js";
import { logCommandAudit } from "../lib/audit.js";
import type { MaiaCommand } from "./types.js";

export const memberCommand: MaiaCommand = {
  data: new SlashCommandBuilder()
    .setName("member")
    .setDescription("Manage server members")
    .addSubcommand((sub) =>
      sub
        .setName("kick")
        .setDescription("Kick a member")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member").setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason").setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("ban")
        .setDescription("Ban a member")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member").setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason").setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("unban")
        .setDescription("Unban a user by ID")
        .addStringOption((opt) =>
          opt
            .setName("user_id")
            .setDescription("User snowflake ID")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("timeout")
        .setDescription("Timeout a member")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member").setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("minutes")
            .setDescription("Duration in minutes (max 40320)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(40320),
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason").setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("untimeout")
        .setDescription("Remove a member timeout")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("nickname")
        .setDescription("Set a member nickname")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member").setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Nickname (empty to clear)")
            .setRequired(false),
        ),
    ),
  async execute(interaction) {
    const guild = requireGuild(interaction);
    const invoker = requireMember(interaction);
    const botMember = getBotMember(guild);
    const sub = interaction.options.getSubcommand(true);
    const actorLabel = invoker.user.tag;

    try {
      if (sub === "kick") {
        assertInvokerPermission(invoker, Perm.KickMembers, "Kick Members");
        assertBotPermission(botMember, Perm.KickMembers, "Kick Members");
        const user = interaction.options.getUser("member", true);
        const reason =
          interaction.options.getString("reason") ??
          `Maia /member kick by ${invoker.user.tag}`;
        const target = await guild.members.fetch(user.id);
        assertMemberManageable(botMember, target);
        await target.kick(reason);
        await logCommandAudit(getDb(), {
          guildId: guild.id,
          actorId: invoker.id,
          actorLabel,
          action: "member.kick",
          targetType: "member",
          targetId: user.id,
          detail: { reason },
          success: true,
        });
        await interaction.reply(`Kicked **${user.tag}**.`);
        return;
      }

      if (sub === "ban") {
        assertInvokerPermission(invoker, Perm.BanMembers, "Ban Members");
        assertBotPermission(botMember, Perm.BanMembers, "Ban Members");
        const user = interaction.options.getUser("member", true);
        const reason =
          interaction.options.getString("reason") ??
          `Maia /member ban by ${invoker.user.tag}`;
        const target = await guild.members.fetch(user.id);
        assertMemberManageable(botMember, target);
        await target.ban({ reason });
        await logCommandAudit(getDb(), {
          guildId: guild.id,
          actorId: invoker.id,
          actorLabel,
          action: "member.ban",
          targetType: "member",
          targetId: user.id,
          detail: { reason },
          success: true,
        });
        await interaction.reply(`Banned **${user.tag}**.`);
        return;
      }

      if (sub === "unban") {
        assertInvokerPermission(invoker, Perm.BanMembers, "Ban Members");
        assertBotPermission(botMember, Perm.BanMembers, "Ban Members");
        const userId = interaction.options.getString("user_id", true).trim();
        if (!/^\d{17,20}$/.test(userId)) {
          throw userFacingError("User ID must be a numeric Discord snowflake.");
        }
        await guild.bans.fetch(userId).catch(() => {
          throw userFacingError("That user is not banned.");
        });
        await guild.members.unban(userId, `Maia /member unban by ${invoker.user.tag}`);
        await logCommandAudit(getDb(), {
          guildId: guild.id,
          actorId: invoker.id,
          actorLabel,
          action: "member.unban",
          targetType: "ban",
          targetId: userId,
          success: true,
        });
        await interaction.reply(`Unbanned user \`${userId}\`.`);
        return;
      }

      if (sub === "timeout") {
        assertInvokerPermission(invoker, Perm.ModerateMembers, "Moderate Members");
        assertBotPermission(botMember, Perm.ModerateMembers, "Moderate Members");
        const user = interaction.options.getUser("member", true);
        const minutes = interaction.options.getInteger("minutes", true);
        const reason =
          interaction.options.getString("reason") ??
          `Maia /member timeout by ${invoker.user.tag}`;
        const target = await guild.members.fetch(user.id);
        assertMemberManageable(botMember, target);
        const durationMs = minutes * 60_000;
        const until = Date.now() + durationMs;
        await target.timeout(durationMs, reason);
        await logCommandAudit(getDb(), {
          guildId: guild.id,
          actorId: invoker.id,
          actorLabel,
          action: "member.timeout",
          targetType: "member",
          targetId: user.id,
          detail: { minutes, until },
          success: true,
        });
        await interaction.reply(
          `Timed out **${user.tag}** until ${time(Math.floor(until / 1000), "F")}.`,
        );
        return;
      }

      if (sub === "untimeout") {
        assertInvokerPermission(invoker, Perm.ModerateMembers, "Moderate Members");
        assertBotPermission(botMember, Perm.ModerateMembers, "Moderate Members");
        const user = interaction.options.getUser("member", true);
        const target = await guild.members.fetch(user.id);
        assertMemberManageable(botMember, target);
        if (!target.communicationDisabledUntil) {
          await interaction.reply({
            content: `${user.tag} is not timed out.`,
            ephemeral: true,
          });
          return;
        }
        await target.timeout(null, `Maia /member untimeout by ${invoker.user.tag}`);
        await logCommandAudit(getDb(), {
          guildId: guild.id,
          actorId: invoker.id,
          actorLabel,
          action: "member.untimeout",
          targetType: "member",
          targetId: user.id,
          success: true,
        });
        await interaction.reply(`Removed timeout for **${user.tag}**.`);
        return;
      }

      if (sub === "nickname") {
        assertInvokerPermission(invoker, Perm.ManageNicknames, "Manage Nicknames");
        assertBotPermission(botMember, Perm.ManageNicknames, "Manage Nicknames");
        const user = interaction.options.getUser("member", true);
        const name = interaction.options.getString("name");
        const target = await guild.members.fetch(user.id);
        assertMemberManageable(botMember, target);
        const nickname = name?.trim() ? name.trim() : null;
        await target.setNickname(
          nickname,
          `Maia /member nickname by ${invoker.user.tag}`,
        );
        await logCommandAudit(getDb(), {
          guildId: guild.id,
          actorId: invoker.id,
          actorLabel,
          action: "member.nickname",
          targetType: "member",
          targetId: user.id,
          detail: { nickname },
          success: true,
        });
        await interaction.reply(
          nickname
            ? `Set nickname for **${user.tag}** to **${nickname}**.`
            : `Cleared nickname for **${user.tag}**.`,
        );
      }
    } catch (error) {
      const message = isUserFacingError(error)
        ? error.message
        : "Something went wrong.";
      const actionMap: Record<string, import("@maia/db").AuditAction> = {
        kick: "member.kick",
        ban: "member.ban",
        unban: "member.unban",
        timeout: "member.timeout",
        untimeout: "member.untimeout",
        nickname: "member.nickname",
      };
      await logCommandAudit(getDb(), {
        guildId: guild.id,
        actorId: invoker.id,
        actorLabel,
        action: actionMap[sub] ?? "member.kick",
        targetType: sub === "unban" ? "ban" : "member",
        targetId:
          interaction.options.getUser("member")?.id ??
          interaction.options.getString("user_id") ??
          guild.id,
        success: false,
        errorMessage: message,
      }).catch(() => undefined);
      throw error;
    }
  },
};
