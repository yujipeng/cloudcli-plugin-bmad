import type { MethodologyItem, MethodologyGroup } from './types.js';

const PHASE_ORDER = [
  '1-analysis',
  '2-planning',
  '3-solutioning',
  '4-implementation',
  'anytime',
];

const PHASE_DISPLAY_NAMES: Record<string, string> = {
  '1-analysis': '分析',
  '2-planning': '规划',
  '3-solutioning': '方案设计',
  '4-implementation': '实现',
  'anytime': '通用工具',
};

export function groupByPhase(items: MethodologyItem[]): MethodologyGroup[] {
  const grouped = new Map<string, MethodologyItem[]>();

  for (const item of items) {
    const list = grouped.get(item.phase);
    if (list) {
      list.push(item);
    } else {
      grouped.set(item.phase, [item]);
    }
  }

  const orderedPhases: string[] = [];
  for (const p of PHASE_ORDER) {
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
