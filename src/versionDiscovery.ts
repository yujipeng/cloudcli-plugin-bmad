import fs from 'node:fs';
import path from 'node:path';
import type { VersionInfo } from './types.js';

export function hasCurrentWorkspace(planBase: string, implBase: string): boolean {
  return fs.existsSync(planBase) || fs.existsSync(implBase);
}

export function getNextArchiveVersion(existingVersions: VersionInfo[]): string {
  const archived = existingVersions
    .filter(v => v.kind === 'archived')
    .map(v => parseInt(v.id.slice(1)))
    .filter(n => !isNaN(n));
  const max = archived.length > 0 ? Math.max(...archived) : 0;
  return `v${max + 1}`;
}

export function discoverVersionEntries(planBase: string, implBase: string): VersionInfo[] {
  const docsDir = path.dirname(planBase);
  const planLeaf = path.basename(planBase);
  const implLeaf = path.basename(implBase);

  const versions: VersionInfo[] = [];

  if (hasCurrentWorkspace(planBase, implBase)) {
    versions.push({
      id: '__current__',
      label: '当前',
      kind: 'current',
      planningDir: planBase,
      implementationDir: implBase,
    });
  }

  if (fs.existsSync(docsDir)) {
    let vDirs: string[];
    try {
      vDirs = fs.readdirSync(docsDir)
        .filter(d => /^v\d+$/.test(d))
        .filter(d => {
          const full = path.join(docsDir, d);
          try { return fs.statSync(full).isDirectory(); } catch { return false; }
        })
        .filter(d => {
          const vPath = path.join(docsDir, d);
          return fs.existsSync(path.join(vPath, planLeaf)) || fs.existsSync(path.join(vPath, implLeaf));
        })
        .sort((a, b) => parseInt(b.slice(1)) - parseInt(a.slice(1)));
    } catch {
      vDirs = [];
    }

    for (const v of vDirs) {
      versions.push({
        id: v,
        label: v.toUpperCase(),
        kind: 'archived',
        planningDir: path.join(docsDir, v, planLeaf),
        implementationDir: path.join(docsDir, v, implLeaf),
      });
    }
  }

  return versions;
}
