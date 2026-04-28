import type { VersionInfo, VersionFlowData, ArchiveSuggestion } from './types.js';
import { getNextArchiveVersion } from './versionDiscovery.js';

export function isWorkspaceEmpty(artifacts: { productBrief: boolean; prd: boolean; architecture: boolean; uxDesign: boolean; epics: boolean; sprintStatus: boolean }): boolean {
  return !artifacts.productBrief && !artifacts.prd && !artifacts.architecture && !artifacts.uxDesign && !artifacts.epics && !artifacts.sprintStatus;
}

export function detectArchiveSuggestion(
  currentVersion: VersionFlowData,
  allVersions: VersionInfo[],
): ArchiveSuggestion {
  if (currentVersion.version.kind !== 'current') {
    return { enabled: false };
  }

  const retroPhase = currentVersion.phases.find(p => p.phase === 'retrospective');
  if (!retroPhase || retroPhase.status !== 'done') {
    return { enabled: false, reason: '当前版本尚未完成复盘' };
  }

  if (!currentVersion.bmadDetected) {
    return { enabled: false, reason: '当前工作区为空' };
  }

  const discoveryPhase = currentVersion.phases.find(p => p.phase === 'discovery');
  if (!discoveryPhase || discoveryPhase.status === 'pending') {
    return { enabled: false, reason: '当前工作区为空' };
  }

  const targetVersion = getNextArchiveVersion(allVersions);

  return { enabled: true, targetVersion };
}
