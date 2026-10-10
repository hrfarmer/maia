import { SlashCommandBuilder } from "discord.js";
import { getDb } from "@maia/db";
import {
  assertBotPermission,
  assertInvokerPermission,
  assertRoleManageable,
  getBotMember,
  Perm,
  requireGuild,
  requireMember,
} from "../lib/guards.js";
import { isUserFacingError, userFacingError } from "../lib/errors.js";
import { logCommandAudit } from "../lib/audit.js";
import type { MaiaCommand } from "./types.js";

export const roleCommand: MaiaCommand = {
  data: new SlashCommandBuilder()
    .setName("role")
    .setDescription("Manage server roles")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a role to a member")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member").setRequired(true),
        )
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Role").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a role from a member")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member").setRequired(true),
        )
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Role").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a role")
        .addStringOption((opt) =>
          opt.setName("name").setDescription("Role name").setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("color")
            .setDescription("Hex color, e.g. #5865F2")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete a role")
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Role").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Rename a role")
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Role").setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName("name").setDescription("New name").setRequired(true),
        ),
    ),
  async execute(interaction) {
    const guild = requireGuild(interaction);
    const invoker = requireMember(interaction);
    const botMember = getBotMember(guild);
    const sub = interaction.options.getSubcommand(true);

    assertInvokerPermission(invoker, Perm.ManageRoles, "Manage Roles");
    assertBotPermission(botMember, Perm.ManageRoles, "Manage Roles");

    const actorLabel = invoker.user.tag;

    try {
      if (sub === "add" || sub === "remove") {
        const targetUser = interaction.options.getUser("member", true);
        const roleRef = interaction.options.getRole("role", true);
        const role = await guild.roles.fetch(roleRef.id);
        if (!role) {
          throw userFacingError("Role not found.");
        }
        const targetMember = await guild.members.fetch(targetUser.id);
        assertRoleManageable(botMember, role, sub === "add" ? "assigned" : "removed");

        const hasRole = targetMember.roles.cache.has(role.id);
        if (sub === "add") {
          if (hasRole) {
            await interaction.reply({
              content: `${targetUser.tag} already has ${role.name}.`,
              ephemeral: true,
            });
            return;
          }
          await targetMember.roles.add(role, `Maia /role add by ${invoker.user.tag}`);
          await logCommandAudit(getDb(), {
            guildId: guild.id,
            actorId: invoker.id,
            actorLabel,
            action: "role.add",
            targetType: "member",
            targetId: targetUser.id,
            detail: { roleId: role.id, roleName: role.name },
            success: true,
          });
          await interaction.reply(
            `Added **${role.name}** to ${targetUser.tag}.`,
          );
          return;
        }

        if (!hasRole) {
          await interaction.reply({
            content: `${targetUser.tag} does not have ${role.name}.`,
            ephemeral: true,
          });
          return;
        }
        await targetMember.roles.remove(role, `Maia /role remove by ${invoker.user.tag}`);
        await logCommandAudit(getDb(), {
          guildId: guild.id,
          actorId: invoker.id,
          actorLabel,
          action: "role.remove",
          targetType: "member",
          targetId: targetUser.id,
          detail: { roleId: role.id, roleName: role.name },
          success: true,
        });
        await interaction.reply(
          `Removed **${role.name}** from ${targetUser.tag}.`,
        );
        return;
      }

      if (sub === "create") {
        const name = interaction.options.getString("name", true).trim();
        const colorRaw = interaction.options.getString("color");
        let color: number | undefined;
        if (colorRaw) {
          const normalized = colorRaw.replace("#", "");
          if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
            throw userFacingError("Color must be a hex value like `#5865F2`.");
          }
          color = Number.parseInt(normalized, 16);
        }
        const created = await guild.roles.create({
          name,
          color,
          reason: `Maia /role create by ${invoker.user.tag}`,
        });
        await logCommandAudit(getDb(), {
          guildId: guild.id,
          actorId: invoker.id,
          actorLabel,
          action: "role.create",
          targetType: "role",
          targetId: created.id,
          detail: { name: created.name },
          success: true,
        });
        await interaction.reply(`Created role **${created.name}**.`);
        return;
      }

      if (sub === "delete") {
        const roleRef = interaction.options.getRole("role", true);
        const role = await guild.roles.fetch(roleRef.id);
        if (!role) {
          throw userFacingError("Role not found.");
        }
        assertRoleManageable(botMember, role, "deleted");
        const roleName = role.name;
        const roleId = role.id;
        await role.delete(`Maia /role delete by ${invoker.user.tag}`);
        await logCommandAudit(getDb(), {
          guildId: guild.id,
          actorId: invoker.id,
          actorLabel,
          action: "role.delete",
          targetType: "role",
          targetId: roleId,
          detail: { name: roleName },
          success: true,
        });
        await interaction.reply(`Deleted role **${roleName}**.`);
        return;
      }

      if (sub === "edit") {
        const roleRef = interaction.options.getRole("role", true);
        const role = await guild.roles.fetch(roleRef.id);
        if (!role) {
          throw userFacingError("Role not found.");
        }
        assertRoleManageable(botMember, role, "edited");
        const name = interaction.options.getString("name", true).trim();
        const previous = role.name;
        await role.setName(name, `Maia /role edit by ${invoker.user.tag}`);
        await logCommandAudit(getDb(), {
          guildId: guild.id,
          actorId: invoker.id,
          actorLabel,
          action: "role.update",
          targetType: "role",
          targetId: role.id,
          detail: { previousName: previous, name },
          success: true,
        });
        await interaction.reply(`Renamed **${previous}** to **${name}**.`);
      }
    } catch (error) {
      const message = isUserFacingError(error)
        ? error.message
        : "Something went wrong.";
      await logCommandAudit(getDb(), {
        guildId: guild.id,
        actorId: invoker.id,
        actorLabel,
        action: sub === "add" ? "role.add" : sub === "remove" ? "role.remove" : sub === "create" ? "role.create" : sub === "delete" ? "role.delete" : "role.update",
        targetType: "role",
        targetId: interaction.options.getRole("role")?.id ?? guild.id,
        success: false,
        errorMessage: message,
      }).catch(() => undefined);
      throw error;
    }
  },
};
