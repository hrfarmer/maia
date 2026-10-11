import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { spawn } from "node:child_process";

export interface RunPluginProcessInput {
  cwd: string;
  command: string[];
  env: Record<string, string>;
  stdin: string;
  timeLimitMs: number;
  spawnProcess?: typeof spawn;
  now?: () => number;
}

export interface RunPluginProcessResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
}

export interface ProcessLogSink {
  onStdout(chunk: string): void;
  onStderr(chunk: string): void;
}

function waitForExit(
  child: ChildProcessWithoutNullStreams,
): Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (exitCode, signal) => {
      resolve({ exitCode, signal });
    });
  });
}

export async function runPluginProcess(
  input: RunPluginProcessInput,
  log: ProcessLogSink,
): Promise<RunPluginProcessResult> {
  const spawnFn = input.spawnProcess ?? spawn;
  const child = spawnFn(input.command[0], input.command.slice(1), {
    cwd: input.cwd,
    env: input.env,
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
  });

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => log.onStdout(chunk));
  child.stderr.on("data", (chunk: string) => log.onStderr(chunk));

  child.stdin.write(input.stdin);
  child.stdin.end();

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGKILL");
  }, input.timeLimitMs);
  timeout.unref?.();

  try {
    const { exitCode, signal } = await waitForExit(child);
    return { exitCode, signal, timedOut };
  } finally {
    clearTimeout(timeout);
  }
}
