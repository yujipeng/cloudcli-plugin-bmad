import type { MethodologyItem, MethodologyGroup, MethodologySection, AgentGroup } from './types.js';

const PHASE_ORDER = [
  '1-discovery',
  '2-planning',
  '3-solution-design',
  '4-implementation',
];

const PHASE_DISPLAY_NAMES: Record<string, string> = {
  '1-discovery': '发现与分析',
  '2-planning': '规划',
  '3-solution-design': '方案设计',
  '4-implementation': '实现',
};

const PHASE_ALIASES: Record<string, string> = {
  '1-analysis': '1-discovery',
  '3-solutioning': '3-solution-design',
};

const PHASE_SET = new Set(PHASE_ORDER);

function toAgentDisplayName(agentName: string): string {
  return agentName
    .replace(/^bmad-agent-/, '')
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function buildMethodologySections(items: MethodologyItem[]): MethodologySection[] {
  const phaseItems: MethodologyItem[] = [];
  const agentItems: MethodologyItem[] = [];
  const generalItems: MethodologyItem[] = [];

  for (let item of items) {
    const resolved = PHASE_ALIASES[item.phase] ?? item.phase;
    if (resolved !== item.phase) item = { ...item, phase: resolved };

    if (item.agentName && item.phase === 'agent') {
      agentItems.push(item);
    } else if (PHASE_SET.has(item.phase)) {
      phaseItems.push(item);
    } else {
      generalItems.push(item);
    }
  }

  const sections: MethodologySection[] = [];

  if (phaseItems.length > 0) {
    const grouped = new Map<string, MethodologyItem[]>();
    for (const item of phaseItems) {
      const list = grouped.get(item.phase);
      if (list) list.push(item);
      else grouped.set(item.phase, [item]);
    }
    const groups: MethodologyGroup[] = PHASE_ORDER
      .filter(p => grouped.has(p))
      .map(p => ({ phase: p, displayName: PHASE_DISPLAY_NAMES[p] ?? p, items: grouped.get(p)! }));

    sections.push({ kind: 'phase-workflows', displayName: '阶段工作流', icon: '🔄', groups });
  }

  if (agentItems.length > 0) {
    const grouped = new Map<string, MethodologyItem[]>();
    for (const item of agentItems) {
      const list = grouped.get(item.agentName);
      if (list) list.push(item);
      else grouped.set(item.agentName, [item]);
    }
    const agents: AgentGroup[] = [...grouped.entries()].map(([name, items]) => ({
      agentName: name,
      displayName: toAgentDisplayName(name),
      items,
    }));

    sections.push({ kind: 'agents', displayName: 'Agent', icon: '🤖', agents });
  }

  if (generalItems.length > 0) {
    const bmadItems = generalItems.filter(i => i.module === 'BMad Method');
    const coreItems = generalItems.filter(i => i.module !== 'BMad Method');
    const groups: MethodologyGroup[] = [];
    if (bmadItems.length > 0) groups.push({ phase: 'bmad-method', displayName: 'BMad Method', items: bmadItems });
    if (coreItems.length > 0) groups.push({ phase: 'core', displayName: 'Core', items: coreItems });

    sections.push({ kind: 'general', displayName: '通用能力', icon: '🧰', groups });
  }

  return sections;
}

export function groupByPhase(items: MethodologyItem[]): MethodologyGroup[] {
  const grouped = new Map<string, MethodologyItem[]>();

  for (const item of items) {
    const phase = PHASE_ALIASES[item.phase] ?? item.phase;
    const list = grouped.get(phase);
    if (list) {
      list.push(item);
    } else {
      grouped.set(phase, [item]);
    }
  }

  const allPhases = [...PHASE_ORDER, 'anytime'];
  const orderedPhases: string[] = [];
  for (const p of allPhases) {
    if (grouped.has(p)) orderedPhases.push(p);
  }
  for (const p of grouped.keys()) {
    if (!orderedPhases.includes(p)) orderedPhases.push(p);
  }

  return orderedPhases.map(phase => ({
    phase,
    displayName: PHASE_DISPLAY_NAMES[phase] ?? phase,
    items: grouped.get(phase) ?? [],
  }));
}
