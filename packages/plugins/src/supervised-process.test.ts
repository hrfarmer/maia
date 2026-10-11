import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { describe, it } from "node:test";
import { spawnSupervisedPluginProcess } from "./supervised-process.js";

const node = process.execPath;

describe("spawnSupervisedPluginProcess", () => {
  it("keeps stdin open for later writes", async () => {
    let stdout = "";
    const handle = spawnSupervisedPluginProcess({
      cwd: process.cwd(),
      command: [
        node,
        "-e",
        `process.stdin.setEncoding('utf8');
let buf='';
process.stdin.on('data',c=>{buf+=c;});
process.stdin.on('end',()=>{console.log('closed');process.exit(1);});
setTimeout(()=>{console.log(buf);process.exit(0);},200);`,
      ],
      env: { NODE_ENV: "test" },
      spawnProcess: spawn,
      log: {
        onStdout(chunk) {
          stdout += chunk;
        },
        onStderr() {},
      },
    });

    handle.writeStdin('{"guildId":"1","change":"enabled"}');
    const { exitCode } = await handle.waitForExit();
    assert.equal(exitCode, 0);
    assert.equal(stdout.trim(), '{"guildId":"1","change":"enabled"}');
  });

  it("resolves every waitForExit caller when the process exits once", async () => {
    const handle = spawnSupervisedPluginProcess({
      cwd: process.cwd(),
      command: [node, "-e", "setTimeout(() => process.exit(0), 10);"],
      env: { NODE_ENV: "test" },
      spawnProcess: spawn,
    });
    const first = handle.waitForExit();
    const second = handle.waitForExit();
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a.exitCode, 0);
    assert.deepEqual(b, a);
  });

  it("uses only the provided env without inheriting the bot", async () => {
    let stdout = "";
    const handle = spawnSupervisedPluginProcess({
      cwd: process.cwd(),
      command: [
        node,
        "-e",
        "console.log(JSON.stringify({ token: process.env.MAIA_PLUGIN_TOKEN ?? null, hasDiscord: Object.prototype.hasOwnProperty.call(process.env, 'DISCORD_TOKEN') }));",
      ],
      env: { MAIA_PLUGIN_TOKEN: "mplg_test" },
      spawnProcess: spawn,
      log: {
        onStdout(chunk) {
          stdout += chunk;
        },
        onStderr() {},
      },
    });
    const { exitCode } = await handle.waitForExit();
    assert.equal(exitCode, 0);
    assert.deepEqual(JSON.parse(stdout.trim()), {
      token: "mplg_test",
      hasDiscord: false,
    });
  });
});
