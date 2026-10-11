import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { spawn } from "node:child_process";

export interface SupervisedProcessLogSink {
  onStdout(chunk: string): void;
  onStderr(chunk: string): void;
}

export interface SpawnSupervisedPluginProcessInput {
  cwd: string;
  command: string[];
  env: Record<string, string>;
  spawnProcess?: typeof spawn;
  log?: SupervisedProcessLogSink;
}

export interface SupervisedPluginProcessHandle {
  writeStdin(line: string): void;
  kill(signal?: NodeJS.Signals): void;
  waitForExit(): Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>;
}

export function spawnSupervisedPluginProcess(
  input: SpawnSupervisedPluginProcessInput,
): SupervisedPluginProcessHandle {
  const spawnFn = input.spawnProcess ?? spawn;
  const child = spawnFn(input.command[0], input.command.slice(1), {
    cwd: input.cwd,
    env: input.env,
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
  });

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  if (input.log) {
    child.stdout.on("data", (chunk: string) => input.log!.onStdout(chunk));
    child.stderr.on("data", (chunk: string) => input.log!.onStderr(chunk));
  }

  let exitResult:
    | Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>
    | undefined;
  const waitForExit = () => {
    if (!exitResult) {
      exitResult = new Promise((resolve, reject) => {
        child.on("error", reject);
        child.on("close", (exitCode, signal) => resolve({ exitCode, signal }));
      });
    }
    return exitResult;
  };

  return {
    writeStdin(line: string) {
      if (!child.stdin.writable) {
        return;
      }
      child.stdin.write(line.endsWith("\n") ? line : `${line}\n`);
    },
    kill(signal: NodeJS.Signals = "SIGTERM") {
      child.kill(signal);
    },
    waitForExit,
  };
}

export type { ChildProcessWithoutNullStreams };
