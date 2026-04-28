import fs from 'node:fs';
import path from 'node:path';

export interface ArchiveResult {
  success: boolean;
  targetVersion: string;
  error?: string;
}

export function archiveCurrentWorkspace(
  planDir: string,
  implDir: string,
  targetDir: string,
): ArchiveResult {
  const targetVersion = path.basename(targetDir);
  const targetPlan = path.join(targetDir, path.basename(planDir));
  const targetImpl = path.join(targetDir, path.basename(implDir));

  if (fs.existsSync(targetDir)) {
    return { success: false, targetVersion, error: `Target ${targetVersion} already exists` };
  }
  if (!fs.existsSync(planDir) || !fs.existsSync(implDir)) {
    return { success: false, targetVersion, error: 'Current workspace directories missing' };
  }

  fs.mkdirSync(targetDir, { recursive: true });

  try {
    fs.renameSync(planDir, targetPlan);
  } catch (e) {
    return { success: false, targetVersion, error: `Failed to move planning-artifacts: ${(e as Error).message}` };
  }

  try {
    fs.renameSync(implDir, targetImpl);
  } catch (e) {
    try { fs.renameSync(targetPlan, planDir); } catch { /* rollback best-effort */ }
    return { success: false, targetVersion, error: `Failed to move implementation-artifacts: ${(e as Error).message}` };
  }

  try {
    fs.mkdirSync(planDir, { recursive: true });
    fs.mkdirSync(implDir, { recursive: true });
  } catch (e) {
    return { success: true, targetVersion, error: `Archived successfully but failed to rebuild workspace: ${(e as Error).message}` };
  }

  return { success: true, targetVersion };
}
