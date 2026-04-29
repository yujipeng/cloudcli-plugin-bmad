import fs from 'node:fs';
import path from 'node:path';

export type ArchiveExecutorMode = 'new' | 'overwrite';

export interface ArchiveResult {
  success: boolean;
  targetVersion: string;
  error?: string;
}

function rmDirRecursive(dir: string): void {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyDirRecursive(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === '.bf-resume-state.json') continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
}

export function archiveCurrentWorkspace(
  planDir: string,
  implDir: string,
  targetDir: string,
  mode: ArchiveExecutorMode = 'new',
): ArchiveResult {
  const targetVersion = path.basename(targetDir);
  const targetPlan = path.join(targetDir, path.basename(planDir));
  const targetImpl = path.join(targetDir, path.basename(implDir));

  if (mode === 'new') {
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
  } else {
    if (!fs.existsSync(targetDir)) {
      return { success: false, targetVersion, error: `Target ${targetVersion} does not exist for overwrite` };
    }
    if (!fs.existsSync(planDir) || !fs.existsSync(implDir)) {
      return { success: false, targetVersion, error: 'Current workspace directories missing' };
    }

    try {
      rmDirRecursive(targetPlan);
      rmDirRecursive(targetImpl);
      copyDirRecursive(planDir, targetPlan);
      copyDirRecursive(implDir, targetImpl);
      rmDirRecursive(planDir);
      rmDirRecursive(implDir);
    } catch (e) {
      return { success: false, targetVersion, error: `Failed to overwrite ${targetVersion}: ${(e as Error).message}` };
    }
  }

  try {
    fs.mkdirSync(planDir, { recursive: true });
    fs.mkdirSync(implDir, { recursive: true });
  } catch (e) {
    return { success: true, targetVersion, error: `Archived successfully but failed to rebuild workspace: ${(e as Error).message}` };
  }

  return { success: true, targetVersion };
}
