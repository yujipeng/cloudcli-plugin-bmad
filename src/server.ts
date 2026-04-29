import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type {
  Phase, PhaseStatus, PhaseInfo, NextAction,
  StoryStatus, EpicEntry, SprintData, FlowData,
  MethodologyResponse,
  VersionInfo, VersionFlowData, VersionedResponse, SprintEntry,
} from './types.js';
import { parseMethodologyCsv } from './methodologyParser.js';
import { buildMethodologySections } from './methodologyViewModel.js';
import { scanSkills } from './skillScanner.js';
import { discoverVersionEntries } from './versionDiscovery.js';
import { detectArchiveSuggestion } from './archiveSuggestion.js';
import { archiveCurrentWorkspace } from './archiveExecutor.js';

// ── Minimal YAML parser (flat key:value + nested map + comments) ──────

function parseSimpleYaml(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  let currentSection = '';
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trimEnd();
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    const m = line.trimStart().match(/^([^:]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim().replace(/^["']|["']$/g, '');
    if (indent === 0 && !val) {
      currentSection = key;
    } else if (indent === 0 && val) {
      result[key] = val;
    } else if (currentSection) {
      result[`${currentSection}.${key}`] = val;
    }
  }
  return result;
}

// ── Config resolution ─────────────────────────────────────────────────

interface BmadPaths {
  planningArtifacts: string;
  implementationArtifacts: string;
  source: string;
}

function resolveBmadPaths(projectPath: string): BmadPaths | null {
  const candidates = ['bmm', 'gds', 'core', 'cis', 'wds', 'tea', 'bmb'];
  for (const mod of candidates) {
    const cfgPath = path.join(projectPath, '_bmad', mod, 'config.yaml');
    if (!fs.existsSync(cfgPath)) continue;
    try {
      const raw = parseSimpleYaml(fs.readFileSync(cfgPath, 'utf-8'));
      const resolve = (v: string) => v.replace('{project-root}', projectPath);
      if (raw['planning_artifacts'] || raw['implementation_artifacts']) {
        return {
          planningArtifacts: resolve(raw['planning_artifacts'] || `${projectPath}/docs`),
          implementationArtifacts: resolve(raw['implementation_artifacts'] || `${projectPath}/docs/stories`),
          source: `_bmad/${mod}/config.yaml`,
        };
      }
    } catch { /* skip */ }
  }
  const outputDir = path.join(projectPath, '_bmad-output');
  if (fs.existsSync(outputDir)) {
    return {
      planningArtifacts: path.join(outputDir, 'planning-artifacts'),
      implementationArtifacts: path.join(outputDir, 'implementation-artifacts'),
      source: '_bmad-output (fallback)',
    };
  }
  return null;
}

// ── Artifact detection ────────────────────────────────────────────────

interface ArtifactMap {
  productBrief: boolean;
  prd: boolean;
  architecture: boolean;
  uxDesign: boolean;
  epics: boolean;
  sprintStatus: boolean;
}

function findFile(dir: string, pattern: RegExp): boolean {
  if (!fs.existsSync(dir)) return false;
  try {
    return fs.readdirSync(dir).some(f => pattern.test(f));
  } catch { return false; }
}

function detectArtifacts(planDir: string, implDir: string): ArtifactMap {
  return {
    productBrief: findFile(planDir, /product.?brief/i),
    prd: findFile(planDir, /prd/i),
    architecture: findFile(planDir, /architect/i),
    uxDesign: findFile(planDir, /ux/i),
    epics: findFile(planDir, /epic/i),
    sprintStatus: findFile(implDir, /sprint.?status\.ya?ml/i),
  };
}

// ── Phase computation ─────────────────────────────────────────────────

function computePhases(a: ArtifactMap, sprint: SprintData | null): PhaseInfo[] {
  const has = (v: boolean) => v;
  const discoveryDone = has(a.productBrief) || has(a.prd);
  const planningDone = has(a.prd) && has(a.epics);
  const designDone = has(a.architecture);
  const devActive = a.sprintStatus && sprint !== null;
  const allStoriesDone = sprint ? sprint.epics.every(e => e.status === 'done') : false;
  const allRetrosDone = sprint ? sprint.epics.length > 0 && sprint.epics.every(e => e.retroStatus === 'done') : false;

  const s = (done: boolean, active: boolean): PhaseStatus =>
    done ? 'done' : active ? 'active' : 'pending';

  return [
    { phase: 'discovery', label: 'Discovery', icon: '🔍', status: s(discoveryDone, !discoveryDone) },
    { phase: 'planning', label: 'Planning', icon: '📋', status: s(planningDone, discoveryDone && !planningDone) },
    { phase: 'design', label: 'Design', icon: '🏗️', status: s(designDone, planningDone && !designDone) },
    { phase: 'development', label: 'Development', icon: '💻', status: s(allStoriesDone, !!devActive && !allStoriesDone) },
    { phase: 'retrospective', label: 'Retrospective', icon: '🔄', status: s(allRetrosDone, allStoriesDone && !allRetrosDone) },
  ];
}

// ── Next action rules (data-driven) ──────────────────────────────────

interface Rule {
  condition: (a: ArtifactMap, sprint: SprintData | null) => boolean;
  action: NextAction;
}

const PHASE_ORDER: Phase[] = ['discovery', 'planning', 'design', 'development', 'retrospective'];

function getPhaseRank(phase: Phase): number {
  return PHASE_ORDER.indexOf(phase);
}

function computeProgressAnchor(a: ArtifactMap, sprint: SprintData | null): Phase | null {
  const hasSprintEvidence = !!a.sprintStatus && !!sprint && sprint.epics.length > 0;
  const allStoriesDone = hasSprintEvidence && sprint.epics.every(e => e.status === 'done');
  const allRetrosDone = hasSprintEvidence && sprint.epics.every(e => e.retroStatus === 'done');

  if (allRetrosDone) return 'retrospective';
  if (allStoriesDone) return 'retrospective';
  if (hasSprintEvidence) return 'development';
  if (a.architecture || a.uxDesign) return 'design';
  if (a.epics || a.prd) return 'planning';
  if (a.productBrief) return 'discovery';
  return null;
}

const RULES: Rule[] = [
  {
    condition: (a) => !a.productBrief && !a.prd,
    action: { phase: 'discovery', command: '/bmad-product-brief', agent: 'Mary', agentIcon: '📊', quote: '咱们先把用户画像摸清楚？' },
  },
  {
    condition: (a) => !a.prd,
    action: { phase: 'planning', command: '/bmad-create-prd', agent: 'John', agentIcon: '📋', quote: '需求不清不动手，先把 PRD 写扎实。' },
  },
  {
    condition: (a) => !a.architecture,
    action: { phase: 'design', command: '/bmad-create-architecture', agent: 'Winston', agentIcon: '🏗️', quote: '地基不牢，地动山摇。来设计架构。' },
  },
  {
    condition: (a) => !a.uxDesign && !a.epics,
    action: { phase: 'design', command: '/bmad-create-ux-design', agent: 'Sally', agentIcon: '🎨', quote: '有 UI？可以先做 UX 设计，也可以跳过直接拆 Epic。', optional: true },
  },
  {
    condition: (a) => !a.epics,
    action: { phase: 'planning', command: '/bmad-create-epics-and-stories', agent: 'John', agentIcon: '📋', quote: '把需求拆成可执行的 Epic 和 Story。' },
  },
  {
    condition: (a) => a.epics && !a.sprintStatus,
    action: { phase: 'development', command: '/bmad-sprint-planning', agent: 'Amelia', agentIcon: '💻', quote: '排好优先级，开干。' },
  },
  {
    condition: (_, s) => !!s && s.epics.some(e => e.stories.some(st => st.status === 'ready-for-dev')),
    action: { phase: 'development', command: '/bmad-dev-story', agent: 'Amelia', agentIcon: '💻', quote: '有 story 等着开发，冲！' },
  },
  {
    condition: (_, s) => !!s && s.epics.some(e => e.stories.some(st => st.status === 'review')),
    action: { phase: 'development', command: '/bmad-code-review', agent: 'Amelia', agentIcon: '💻', quote: '代码写完了，该 review 了。' },
  },
  {
    condition: (_, s) => !!s && s.epics.every(e => e.status === 'done') && s.epics.some(e => e.retroStatus !== 'done'),
    action: { phase: 'retrospective', command: '/bmad-retrospective', agent: 'Bob', agentIcon: '🏃', quote: '全部完成！来复盘总结经验。' },
  },
];

function computeNextAction(a: ArtifactMap, sprint: SprintData | null): NextAction | null {
  const anchor = computeProgressAnchor(a, sprint);
  const minRank = anchor ? getPhaseRank(anchor) : -1;

  for (const rule of RULES) {
    if (getPhaseRank(rule.action.phase) < minRank) continue;
    if (rule.condition(a, sprint)) return rule.action;
  }

  return null;
}

// ── Sprint status parser ──────────────────────────────────────────────

const STORY_STATUSES = new Set<StoryStatus>(['backlog', 'ready-for-dev', 'in-progress', 'review', 'done']);

function parseSprintYaml(raw: Record<string, string>): SprintData | null {
  const project = raw['project'] || '';
  const epics: EpicEntry[] = [];
  let currentEpic: EpicEntry | null = null;

  const devKeys = Object.keys(raw)
    .filter(k => k.startsWith('development_status.'))
    .map(k => [k.replace('development_status.', ''), raw[k]] as [string, string]);

  for (const [key, val] of devKeys) {
    if (key.startsWith('epic-') && !key.includes('-retrospective')) {
      if (/^\d+$/.test(key.replace('epic-', ''))) {
        currentEpic = { key, status: val, stories: [] };
        epics.push(currentEpic);
        continue;
      }
    }
    if (key.endsWith('-retrospective') && currentEpic) {
      currentEpic.retroStatus = val;
      continue;
    }
    if (currentEpic && STORY_STATUSES.has(val as StoryStatus)) {
      currentEpic.stories.push({ key, status: val as StoryStatus });
    }
  }

  let totalStories = 0, doneStories = 0;
  for (const e of epics) {
    totalStories += e.stories.length;
    doneStories += e.stories.filter(s => s.status === 'done').length;
  }

  return { project, epics, totalStories, doneStories };
}

function parseSprintStatus(implDir: string): SprintData | null {
  const files = fs.existsSync(implDir) ? fs.readdirSync(implDir) : [];
  const yamlFile = files.find(f => /sprint.?status\.ya?ml/i.test(f));
  if (!yamlFile) return null;

  try {
    const raw = parseSimpleYaml(fs.readFileSync(path.join(implDir, yamlFile), 'utf-8'));
    return parseSprintYaml(raw);
  } catch {
    return null;
  }
}

// ── Multi-sprint parser ──────────────────────────────────────────────

function parseMultiSprint(implDir: string): SprintEntry[] {
  if (!fs.existsSync(implDir)) return [];

  let files: string[];
  try { files = fs.readdirSync(implDir); } catch { return []; }

  const sprintPattern = /^sprint-?status(?:-(\d+))?\.ya?ml$/i;
  const matches: { num: number; file: string }[] = [];

  for (const f of files) {
    const m = sprintPattern.exec(f);
    if (m) {
      matches.push({ num: m[1] ? parseInt(m[1]) : 1, file: f });
    }
  }

  if (matches.length === 0) return [];
  matches.sort((a, b) => a.num - b.num);

  const entries: SprintEntry[] = [];
  for (const { num, file } of matches) {
    try {
      const raw = parseSimpleYaml(fs.readFileSync(path.join(implDir, file), 'utf-8'));
      const data = parseSprintYaml(raw);
      if (data) {
        entries.push({ sprintNumber: num, fileName: file, data, active: false });
      }
    } catch { /* skip corrupt files */ }
  }

  for (let i = entries.length - 1; i >= 0; i--) {
    const allDone = entries[i].data.epics.every(e => e.status === 'done');
    if (!allDone) {
      entries[i].active = true;
      break;
    }
  }
  if (entries.length > 0 && !entries.some(e => e.active)) {
    entries[entries.length - 1].active = true;
  }

  return entries;
}

// ── Path safety ───────────────────────────────────────────────────────

function safePath(raw: string): string {
  const resolved = path.resolve(raw);
  if (!path.isAbsolute(resolved)) throw new Error('Invalid path');
  if (!fs.existsSync(resolved)) throw new Error('Path does not exist');
  return resolved;
}

// ── Methodology endpoint ─────────────────────────────────────────────

interface CacheEntry {
  mtime: number;
  data: MethodologyResponse;
}

const methodologyCache = new Map<string, CacheEntry>();

function getMethodologyData(projectPath: string): MethodologyResponse {
  const p = safePath(projectPath);

  const skillsDir = path.join(p, '.claude', 'skills');
  if (fs.existsSync(skillsDir)) {
    let dirStat: fs.Stats;
    try { dirStat = fs.statSync(skillsDir); } catch { dirStat = null as unknown as fs.Stats; }
    if (dirStat) {
      let entries: string[];
      try { entries = fs.readdirSync(skillsDir); } catch { entries = []; }
      const cacheKey = `skills:${skillsDir}`;
      const mtime = dirStat.mtimeMs;
      const cached = methodologyCache.get(cacheKey);
      if (cached && cached.mtime === mtime && (cached as CacheEntry & { count?: number }).count === entries.length) {
        return cached.data;
      }
      const items = scanSkills(p);
      if (items.length > 0) {
        const sections = buildMethodologySections(items);
        const data: MethodologyResponse = { sections };
        const entry = { mtime, data, count: entries.length } as CacheEntry & { count: number };
        methodologyCache.set(cacheKey, entry);
        return data;
      }
    }
  }

  const csvPath = path.join(p, '_bmad', 'module-help.csv');

  if (!fs.existsSync(path.join(p, '_bmad'))) {
    return { sections: [], warning: 'no bmad directory' };
  }

  if (!fs.existsSync(csvPath)) {
    return { sections: [], warning: 'methodology file not found' };
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(csvPath);
  } catch {
    return { sections: [], error: 'permission denied' };
  }

  const mtime = stat.mtimeMs;
  const cached = methodologyCache.get(csvPath);
  if (cached && cached.mtime === mtime) {
    return cached.data;
  }

  let csvContent: string;
  try {
    csvContent = fs.readFileSync(csvPath, 'utf-8');
  } catch {
    return { sections: [], error: 'permission denied' };
  }

  const items = parseMethodologyCsv(csvContent);
  const sections = buildMethodologySections(items);
  const data: MethodologyResponse = { sections };

  methodologyCache.set(csvPath, { mtime, data });
  return data;
}

// ── Main handler ──────────────────────────────────────────────────────

function getFlowData(projectPath: string): FlowData {
  const p = safePath(projectPath);
  const bmadDir = path.join(p, '_bmad');
  const bmadDetected = fs.existsSync(bmadDir);

  if (!bmadDetected) {
    return {
      phases: computePhases({ productBrief: false, prd: false, architecture: false, uxDesign: false, epics: false, sprintStatus: false }, null),
      nextAction: null,
      sprint: null,
      bmadDetected: false,
      configSource: '',
    };
  }

  const paths = resolveBmadPaths(p);
  const planDir = paths?.planningArtifacts || path.join(p, 'docs');
  const implDir = paths?.implementationArtifacts || path.join(p, 'docs', 'stories');
  const artifacts = detectArtifacts(planDir, implDir);
  const sprint = artifacts.sprintStatus ? parseSprintStatus(implDir) : null;

  return {
    phases: computePhases(artifacts, sprint),
    nextAction: computeNextAction(artifacts, sprint),
    sprint,
    bmadDetected: true,
    configSource: paths?.source || 'defaults',
  };
}

// ── Versioned handler ────────────────────────────────────────────────

function getVersionedData(projectPath: string): VersionedResponse {
  const p = safePath(projectPath);
  const bmadDir = path.join(p, '_bmad');
  const bmadDetected = fs.existsSync(bmadDir);

  if (!bmadDetected) {
    const emptyFlow: FlowData = {
      phases: computePhases({ productBrief: false, prd: false, architecture: false, uxDesign: false, epics: false, sprintStatus: false }, null),
      nextAction: null, sprint: null, bmadDetected: false, configSource: '',
    };
    return {
      versions: [{
        ...emptyFlow,
        version: { id: '__unversioned__', label: '', kind: 'current' as const, planningDir: '', implementationDir: '' },
        sprints: [], activeSprint: 0,
      }],
      activeVersionId: '__unversioned__',
      unversioned: true,
    };
  }

  const paths = resolveBmadPaths(p);
  const planBase = paths?.planningArtifacts || path.join(p, 'docs', 'planning-artifacts');
  const implBase = paths?.implementationArtifacts || path.join(p, 'docs', 'implementation-artifacts');
  const versions = discoverVersionEntries(planBase, implBase);
  const unversioned = versions.length === 1 && versions[0].id === '__current__' && !versions.some(v => v.kind === 'archived');

  const versionFlows: VersionFlowData[] = versions.map(v => {
    const artifacts = detectArtifacts(v.planningDir, v.implementationDir);
    const sprints = parseMultiSprint(v.implementationDir);
    const activeSprint = sprints.find(s => s.active);
    const sprint = activeSprint?.data ?? (artifacts.sprintStatus ? parseSprintStatus(v.implementationDir) : null);
    const flowData: VersionFlowData = {
      phases: computePhases(artifacts, sprint),
      nextAction: computeNextAction(artifacts, sprint),
      sprint,
      bmadDetected: true,
      configSource: paths?.source || 'defaults',
      version: v,
      sprints,
      activeSprint: activeSprint?.sprintNumber ?? 0,
    };
    if (v.kind === 'current') {
      flowData.archiveSuggestion = detectArchiveSuggestion(flowData, versions);
    }
    return flowData;
  });

  let activeVersionId = versions[0]?.id || '__current__';
  for (const vf of versionFlows) {
    if (vf.version.kind === 'current' && vf.phases.some(ph => ph.status === 'active')) {
      activeVersionId = vf.version.id;
      break;
    }
  }

  return { versions: versionFlows, activeVersionId, unversioned };
}

// ── HTTP server ───────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'POST' && req.url?.startsWith('/version/archive-current')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const projectPath = parsed.path;
        if (!projectPath) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'missing path in request body' }));
          return;
        }
        const p = safePath(projectPath);
        const paths = resolveBmadPaths(p);
        const planBase = paths?.planningArtifacts || path.join(p, 'docs', 'planning-artifacts');
        const implBase = paths?.implementationArtifacts || path.join(p, 'docs', 'implementation-artifacts');
        const versions = discoverVersionEntries(planBase, implBase);
        const currentVer = versions.find(v => v.kind === 'current');
        if (!currentVer) {
          res.writeHead(409);
          res.end(JSON.stringify({ error: 'no current workspace to archive' }));
          return;
        }
        const versionFlows = versions.map(v => {
          const artifacts = detectArtifacts(v.planningDir, v.implementationDir);
          const sprints = parseMultiSprint(v.implementationDir);
          const activeSprint = sprints.find(s => s.active);
          const sprint = activeSprint?.data ?? (artifacts.sprintStatus ? parseSprintStatus(v.implementationDir) : null);
          const flowData: VersionFlowData = {
            phases: computePhases(artifacts, sprint),
            nextAction: computeNextAction(artifacts, sprint),
            sprint, bmadDetected: true, configSource: paths?.source || 'defaults',
            version: v, sprints, activeSprint: activeSprint?.sprintNumber ?? 0,
          };
          return flowData;
        });
        const currentFlow = versionFlows.find(vf => vf.version.kind === 'current')!;
        const suggestion = detectArchiveSuggestion(currentFlow, versions);
        if (!suggestion.enabled || !suggestion.targetVersion) {
          res.writeHead(409);
          res.end(JSON.stringify({ error: suggestion.reason || 'archive not allowed' }));
          return;
        }
        const targetDir = path.join(path.dirname(planBase), suggestion.targetVersion);
        const result = archiveCurrentWorkspace(planBase, implBase, targetDir);
        if (!result.success) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: result.error }));
          return;
        }
        const updated = getVersionedData(p);
        res.end(JSON.stringify(updated));
      } catch (err) {
        const code = (err as Error).message.includes('does not exist') ? 404 : 400;
        res.writeHead(code);
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/versions')) {
    try {
      const { searchParams } = new URL(req.url, 'http://localhost');
      const data = getVersionedData(searchParams.get('path') ?? '');
      res.end(JSON.stringify(data));
    } catch (err) {
      const code = (err as Error).message.includes('does not exist') ? 404 : 400;
      res.writeHead(code);
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/methodology')) {
    try {
      const { searchParams } = new URL(req.url, 'http://localhost');
      const data = getMethodologyData(searchParams.get('path') ?? '');
      if (data.error === 'permission denied') {
        res.writeHead(403);
      }
      res.end(JSON.stringify(data));
    } catch (err) {
      const code = (err as Error).message.includes('does not exist') ? 404 : 400;
      res.writeHead(code);
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/flow')) {
    try {
      const { searchParams } = new URL(req.url, 'http://localhost');
      const data = getFlowData(searchParams.get('path') ?? '');
      res.end(JSON.stringify(data));
    } catch (err) {
      const code = (err as Error).message.includes('does not exist') ? 404 : 400;
      res.writeHead(code);
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(0, '127.0.0.1', () => {
  const addr = server.address();
  if (addr && typeof addr !== 'string') {
    console.log(JSON.stringify({ ready: true, port: addr.port }));
  }
});
