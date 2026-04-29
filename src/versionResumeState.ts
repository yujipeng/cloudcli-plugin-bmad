import fs from 'node:fs';
import path from 'node:path';

export interface ResumeState {
  archiveMode: 'overwrite';
  archiveTargetVersionId: string;
}

export function getResumeStatePath(planDir: string): string {
  return path.join(planDir, '.bf-resume-state.json');
}

export function readResumeState(planDir: string): ResumeState | null {
  const statePath = getResumeStatePath(planDir);
  if (!fs.existsSync(statePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf-8')) as ResumeState;
  } catch {
    return null;
  }
}

export function writeResumeState(planDir: string, state: ResumeState): void {
  fs.mkdirSync(planDir, { recursive: true });
  fs.writeFileSync(getResumeStatePath(planDir), JSON.stringify(state));
}

export function clearResumeState(planDir: string): void {
  const statePath = getResumeStatePath(planDir);
  if (fs.existsSync(statePath)) fs.rmSync(statePath);
}
