import type { VersionInfo, VersionFlowData, ArchiveSuggestion } from './types.js';
import type { ResumeState } from './versionResumeState.js';
import { getNextArchiveVersion } from './versionDiscovery.js';

export function isWorkspaceEmpty(artifacts: { productBrief: boolean; prd: boolean; architecture: boolean; uxDesign: boolean; epics: boolean; sprintStatus: boolean }): boolean {
  return !artifacts.productBrief && !artifacts.prd && !artifacts.architecture && !artifacts.uxDesign && !artifacts.epics && !artifacts.sprintStatus;
}

export function detectArchiveSuggestion(
  currentVersion: VersionFlowData,
  allVersions: VersionInfo[],
  resumeState: ResumeState | null = null,
): ArchiveSuggestion {
  if (currentVersion.version.kind !== 'current') {
    return { enabled: false };
  }

  if (!currentVersion.bmadDetected) {
    return { enabled: false, archiveMode: 'disabled', reason: '当前工作区为空' };
  }

  const discoveryPhase = currentVersion.phases.find(p => p.phase === 'discovery');
  if (!discoveryPhase || discoveryPhase.status === 'pending') {
    return { enabled: false, archiveMode: 'disabled', reason: '当前工作区为空' };
  }

  return {
    enabled: true,
    archiveMode: resumeState?.archiveMode === 'overwrite' ? 'overwrite' : 'new',
    targetVersion: resumeState?.archiveTargetVersionId ?? getNextArchiveVersion(allVersions),
  };
}
