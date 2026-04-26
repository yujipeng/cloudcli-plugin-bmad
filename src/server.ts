import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type {
  Phase, PhaseStatus, PhaseInfo, NextAction,
  StoryStatus, StoryEntry, EpicEntry, SprintData, FlowData,
} from './types.js';

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
  const allDone = sprint ? sprint.epics.every(e => e.status === 'done') : false;

  const s = (done: boolean, active: boolean): PhaseStatus =>
    done ? 'done' : active ? 'active' : 'pending';

  return [
    { phase: 'discovery', label: 'Discovery', icon: '🔍', status: s(discoveryDone, !discoveryDone) },
    { phase: 'planning', label: 'Planning', icon: '📋', status: s(planningDone, discoveryDone && !planningDone) },
    { phase: 'design', label: 'Design', icon: '🏗️', status: s(designDone, planningDone && !designDone) },
    { phase: 'development', label: 'Development', icon: '💻', status: s(allDone, !!devActive && !allDone) },
    { phase: 'retrospective', label: 'Retrospective', icon: '🔄', status: s(false, allDone) },
  ];
}

// ── Next action rules (data-driven) ──────────────────────────────────

interface Rule {
  condition: (a: ArtifactMap, sprint: SprintData | null) => boolean;
  action: NextAction;
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
    condition: (_, s) => !!s && s.epics.every(e => e.status === 'done'),
    action: { phase: 'retrospective', command: '/bmad-retrospective', agent: 'Bob', agentIcon: '🏃', quote: '全部完成！来复盘总结经验。' },
  },
];

function computeNextAction(a: ArtifactMap, sprint: SprintData | null): NextAction | null {
  for (const rule of RULES) {
    if (rule.condition(a, sprint)) return rule.action;
  }
  return { phase: 'development', command: '/bmad-create-story', agent: 'Amelia', agentIcon: '💻', quote: '继续创建下一个 Story。' };
}

// ── Sprint status parser ──────────────────────────────────────────────

const STORY_STATUSES = new Set<StoryStatus>(['backlog', 'ready-for-dev', 'in-progress', 'review', 'done']);

function parseSprintStatus(implDir: string): SprintData | null {
  const files = fs.existsSync(implDir) ? fs.readdirSync(implDir) : [];
  const yamlFile = files.find(f => /sprint.?status\.ya?ml/i.test(f));
  if (!yamlFile) return null;

  try {
    const raw = parseSimpleYaml(fs.readFileSync(path.join(implDir, yamlFile), 'utf-8'));
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
  } catch {
    return null;
  }
}

// ── Path safety ───────────────────────────────────────────────────────

function safePath(raw: string): string {
  const resolved = path.resolve(raw);
  if (!path.isAbsolute(resolved)) throw new Error('Invalid path');
  if (!fs.existsSync(resolved)) throw new Error('Path does not exist');
  return resolved;
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

// ── HTTP server ───────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

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
