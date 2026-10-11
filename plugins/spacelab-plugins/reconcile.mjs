/**
 * Bundled Space Lab roster reconcile runner (generated from @maia/plugins).
 * Run: node scripts/bundle-spacelab-reconcile.mjs
 */

export async function runSpacelabGuildReconcile(config, mode = { kind: "full" }) {
  const state = await fetchReconcileState(config);
  if (!state) {
    return { ok: false, reason: "no_roster" };
  }

  const api = createMaiaDiscordRoleApi(config);
  const guildRoleIds = await api.listGuildRoleIds();
  const result = await runReconcilePass(
    {
      rows: state.rows,
      rememberedMembers: state.rememberedMembers,
      links: new Map(Object.entries(state.links)),
      guildRoleIds,
      failures: state.failures,
      mode,
    },
    api,
  );

  await saveReconcileState(config, {
    rows: result.rows,
    links: state.links,
    rememberedMembers: result.rememberedMembers,
    failures: result.failures,
  });

  return { ok: true, stoppedEarly: result.stoppedEarly };
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function fetchReconcileState(config) {
  const base = `${config.pluginUrl}/v1/guilds/${encodeURIComponent(config.guildId)}`;
  const response = await config.fetchImpl(
    `${base}/spacelab-roster/reconcile-state`,
    { headers: authHeaders(config.pluginToken) },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`reconcile state failed: ${response.status}`);
  }
  return response.json();
}

async function saveReconcileState(config, body) {
  const base = `${config.pluginUrl}/v1/guilds/${encodeURIComponent(config.guildId)}`;
  const response = await config.fetchImpl(
    `${base}/spacelab-roster/reconcile-state`,
    {
      method: "PUT",
      headers: {
        ...authHeaders(config.pluginToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    throw new Error(`save reconcile state failed: ${response.status}`);
  }
}

function createMaiaDiscordRoleApi(config) {
  const fetchImpl = config.fetchImpl ?? fetch;
  const base = `${config.pluginUrl}/v1/guilds/${encodeURIComponent(config.guildId)}`;

  return {
    async listGuildRoleIds() {
      const response = await fetchImpl(`${base}/roles`, {
        headers: authHeaders(config.pluginToken),
      });
      if (!response.ok) {
        throw new Error(`list roles failed: ${response.status}`);
      }
      const body = await response.json();
      return new Set((body.roles ?? []).map((role) => role.id));
    },
    async searchMembersByHandle(handle) {
      const response = await fetchImpl(
        `${base}/members?query=${encodeURIComponent(handle)}`,
        { headers: authHeaders(config.pluginToken) },
      );
      if (!response.ok) {
        throw new Error(`member search failed: ${response.status}`);
      }
      const body = await response.json();
      return (body.members ?? [])
        .map((member) => ({
          id: member.user?.id ?? "",
          username: member.user?.username ?? "",
        }))
        .filter((member) => member.id && member.username);
    },
    async getMemberRoleIds(userId) {
      const response = await fetchImpl(`${base}/members/${userId}/roles`, {
        headers: authHeaders(config.pluginToken),
      });
      if (!response.ok) {
        throw new Error(`get member roles failed: ${response.status}`);
      }
      const body = await response.json();
      return body.roleIds ?? [];
    },
    async addRole(userId, roleId) {
      const response = await fetchImpl(
        `${base}/members/${userId}/roles/${roleId}`,
        {
          method: "PUT",
          headers: authHeaders(config.pluginToken),
        },
      );
      if (!response.ok) {
        throw new Error(`add role failed: ${response.status}`);
      }
    },
    async removeRole(userId, roleId) {
      const response = await fetchImpl(
        `${base}/members/${userId}/roles/${roleId}`,
        {
          method: "DELETE",
          headers: authHeaders(config.pluginToken),
        },
      );
      if (!response.ok) {
        throw new Error(`remove role failed: ${response.status}`);
      }
    },
  };
}

const MAX_RECONCILE_MEMBER_ATTEMPTS = 5;
const MAX_CONSECUTIVE_DISCORD_ERRORS = 3;

function rosterStatusIsActive(status) {
  return (
    status.localeCompare("Active", undefined, { sensitivity: "accent" }) === 0
  );
}

function buildManagedLinkedRoleIds(links, guildRoleIds) {
  const managed = new Set();
  for (const roleId of links.values()) {
    if (guildRoleIds.has(roleId)) {
      managed.add(roleId);
    }
  }
  return managed;
}

function desiredLinkedRoleIdsForValues(adaptRoleValues, links, guildRoleIds) {
  const desired = new Set();
  for (const value of adaptRoleValues) {
    const roleId = links.get(value);
    if (roleId && guildRoleIds.has(roleId)) {
      desired.add(roleId);
    }
  }
  return desired;
}

function exactUsernameMatches(members, discordHandle) {
  return members.filter(
    (member) =>
      member.username.localeCompare(discordHandle, undefined, {
        sensitivity: "accent",
      }) === 0,
  );
}

function failureKeyForMember(discordHandle, storedUserId) {
  return storedUserId ?? discordHandle.toLowerCase();
}

function storedUserIdForHandle(discordHandle, rows, rememberedMembers) {
  const row = rows.find(
    (item) =>
      item.discordHandle.toLowerCase() === discordHandle.toLowerCase(),
  );
  if (row?.discordUserId) {
    return row.discordUserId;
  }
  const remembered = rememberedMembers.find(
    (member) =>
      member.discordHandle.toLowerCase() === discordHandle.toLowerCase(),
  );
  return remembered?.discordUserId;
}

function upsertFailure(failures, memberKey, discordHandle) {
  const existing = failures.find((failure) => failure.memberKey === memberKey);
  if (!existing) {
    return [...failures, { memberKey, discordHandle, attempts: 1 }];
  }
  return failures.map((failure) =>
    failure.memberKey === memberKey
      ? { ...failure, attempts: failure.attempts + 1, discordHandle }
      : failure,
  );
}

function removeFailure(failures, memberKey) {
  return failures.filter((failure) => failure.memberKey !== memberKey);
}

function rememberMember(remembered, discordUserId, discordHandle) {
  const without = remembered.filter(
    (member) => member.discordUserId !== discordUserId,
  );
  return [...without, { discordUserId, discordHandle }];
}

function buildWorkItems(input) {
  const rosterByHandle = new Map();
  for (const row of input.rows) {
    rosterByHandle.set(row.discordHandle.toLowerCase(), row);
  }
  const rememberedByUserId = new Map(
    input.rememberedMembers.map((member) => [member.discordUserId, member]),
  );
  const failures = new Map(
    input.failures.map((failure) => [failure.memberKey, failure]),
  );
  const items = [];
  const seen = new Set();

  const shouldInclude = (memberKey) => {
    const failure = failures.get(memberKey);
    if (failure && failure.attempts >= MAX_RECONCILE_MEMBER_ATTEMPTS) {
      return false;
    }
    if (input.mode.kind === "retry-failures-only") {
      return Boolean(failure);
    }
    return true;
  };

  const pushItem = (item) => {
    if (seen.has(item.memberKey)) {
      return;
    }
    if (!shouldInclude(item.memberKey)) {
      return;
    }
    seen.add(item.memberKey);
    items.push(item);
  };

  for (const row of [...input.rows].sort((a, b) =>
    a.discordHandle.localeCompare(b.discordHandle),
  )) {
    const remembered = [...rememberedByUserId.values()].find(
      (member) =>
        member.discordHandle.toLowerCase() === row.discordHandle.toLowerCase(),
    );
    const discordUserId = row.discordUserId ?? remembered?.discordUserId;
    const memberKey = failureKeyForMember(
      row.discordHandle,
      storedUserIdForHandle(
        row.discordHandle,
        input.rows,
        input.rememberedMembers,
      ),
    );
    const active = rosterStatusIsActive(row.status);
    const hasValues = row.adaptRoleValues.length > 0;
    const isRemembered =
      Boolean(discordUserId && rememberedByUserId.has(discordUserId)) ||
      Boolean(remembered);

    if (active && hasValues) {
      pushItem({
        discordHandle: row.discordHandle,
        discordUserId,
        rosterRow: row,
        desiredLinkedRoleIds: desiredLinkedRoleIdsForValues(
          row.adaptRoleValues,
          input.links,
          input.guildRoleIds,
        ),
        memberKey,
      });
      continue;
    }

    if (isRemembered && (!active || !hasValues)) {
      pushItem({
        discordHandle: row.discordHandle,
        discordUserId,
        rosterRow: row,
        desiredLinkedRoleIds: new Set(),
        memberKey,
      });
    }
  }

  for (const remembered of [...input.rememberedMembers].sort((a, b) =>
    a.discordHandle.localeCompare(b.discordHandle),
  )) {
    if (rosterByHandle.has(remembered.discordHandle.toLowerCase())) {
      continue;
    }
    const memberKey = failureKeyForMember(
      remembered.discordHandle,
      storedUserIdForHandle(
        remembered.discordHandle,
        input.rows,
        input.rememberedMembers,
      ),
    );
    pushItem({
      discordHandle: remembered.discordHandle,
      discordUserId: remembered.discordUserId,
      desiredLinkedRoleIds: new Set(),
      memberKey,
    });
  }

  return items;
}

async function runReconcilePass(input, api) {
  const guildRoleIds =
    input.guildRoleIds.size > 0
      ? input.guildRoleIds
      : await api.listGuildRoleIds();
  const managedRoleIds = buildManagedLinkedRoleIds(input.links, guildRoleIds);
  const workItems = buildWorkItems({ ...input, guildRoleIds });

  let rows = input.rows.map((row) => ({ ...row }));
  let rememberedMembers = [...input.rememberedMembers];
  let failures = [...input.failures];
  let consecutiveDiscordErrors = 0;
  let stoppedEarly = false;

  const updateRowUserId = (handle, userId) => {
    rows = rows.map((row) =>
      row.discordHandle.toLowerCase() === handle.toLowerCase()
        ? { ...row, discordUserId: userId }
        : row,
    );
  };

  for (const item of workItems) {
    if (consecutiveDiscordErrors >= MAX_CONSECUTIVE_DISCORD_ERRORS) {
      stoppedEarly = true;
      break;
    }

    const storedUserId = storedUserIdForHandle(
      item.discordHandle,
      rows,
      rememberedMembers,
    );
    let userId = item.discordUserId ?? storedUserId;
    if (!userId) {
      const searchResults = await api.searchMembersByHandle(item.discordHandle);
      const matches = exactUsernameMatches(searchResults, item.discordHandle);
      if (matches.length !== 1) {
        continue;
      }
      userId = matches[0].id;
    }

    const failureKey = failureKeyForMember(item.discordHandle, storedUserId);
    const handleFailureKey = item.discordHandle.toLowerCase();

    try {
      const currentRoleIds = await api.getMemberRoleIds(userId);
      const currentManaged = currentRoleIds.filter((roleId) =>
        managedRoleIds.has(roleId),
      );
      const desired = item.desiredLinkedRoleIds;
      const toAdd = [...desired].filter(
        (roleId) => !currentManaged.includes(roleId),
      );
      const toRemove = currentManaged.filter((roleId) => !desired.has(roleId));

      for (const roleId of toAdd) {
        await api.addRole(userId, roleId);
      }
      for (const roleId of toRemove) {
        await api.removeRole(userId, roleId);
      }

      consecutiveDiscordErrors = 0;
      updateRowUserId(item.discordHandle, userId);
      rememberedMembers = rememberMember(
        rememberedMembers,
        userId,
        item.discordHandle,
      );
      failures = removeFailure(failures, failureKey);
      failures = removeFailure(failures, handleFailureKey);
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
      consecutiveDiscordErrors += 1;
      let nextFailures = failures;
      if (handleFailureKey !== failureKey) {
        nextFailures = removeFailure(nextFailures, handleFailureKey);
      }
      failures = upsertFailure(nextFailures, failureKey, item.discordHandle);
    }
  }

  return {
    rows,
    rememberedMembers,
    failures,
    stoppedEarly,
  };
}
