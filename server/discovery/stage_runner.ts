import { execFile } from 'node:child_process';
import path from 'node:path';

export interface StageScriptResult {
  script: string;
  output: Record<string, unknown>;
}

export type StageScriptRunner = (script: string, args?: string[]) => Promise<StageScriptResult>;

export const runStageScript: StageScriptRunner = (script, args = []) => new Promise((resolve, reject) => {
  const tsx = path.join(process.cwd(), 'node_modules', '.bin', 'tsx');
  execFile(tsx, [script, ...args], { cwd: process.cwd(), timeout: 5 * 60_000, maxBuffer: 16 * 1024 * 1024 },
    (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`V3_STAGE_FAILED:${script}:${error.message}:${stderr.trim().slice(0, 1_000)}`)); return;
      }
      try { resolve({ script, output: JSON.parse(stdout.trim()) as Record<string, unknown> }); }
      catch { reject(new Error(`V3_STAGE_INVALID_JSON:${script}:${stdout.trim().slice(0, 1_000)}`)); }
    });
});
