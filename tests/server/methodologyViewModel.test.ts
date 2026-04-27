import { describe, it, expect } from 'vitest';
import { groupByPhase } from '../../src/methodologyViewModel.js';
import type { MethodologyItem } from '../../src/types.js';

function item(phase: string, name: string): MethodologyItem {
  return { skill: `bmad-${name}`, displayName: name, menuCode: '', description: '', required: false, category: 'workflow', phase };
}

describe('groupByPhase', () => {
  it('groups items by phase in correct order', () => {
    const items: MethodologyItem[] = [
      item('anytime', 'help'),
      item('1-analysis', 'brainstorm'),
      item('4-implementation', 'dev-story'),
      item('2-planning', 'create-prd'),
    ];

    const groups = groupByPhase(items);
    expect(groups.map(g => g.phase)).toEqual([
      '1-analysis', '2-planning', '4-implementation', 'anytime',
    ]);
  });

  it('assigns correct displayName for known phases', () => {
    const items = [item('anytime', 'help')];
    const groups = groupByPhase(items);
    expect(groups[0].displayName).toBe('通用工具');
  });

  it('uses phase string as displayName for unknown phases', () => {
    const items = [item('custom-phase', 'custom')];
    const groups = groupByPhase(items);
    expect(groups[0].displayName).toBe('custom-phase');
  });

  it('returns empty array for no items', () => {
    expect(groupByPhase([])).toEqual([]);
  });

  it('places unknown phases after known ones', () => {
    const items = [
      item('unknown', 'x'),
      item('1-analysis', 'a'),
    ];
    const groups = groupByPhase(items);
    expect(groups[0].phase).toBe('1-analysis');
    expect(groups[1].phase).toBe('unknown');
  });

  it('groups multiple items under same phase', () => {
    const items = [
      item('anytime', 'help'),
      item('anytime', 'customize'),
    ];
    const groups = groupByPhase(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
  });
});
