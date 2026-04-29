import { describe, it, expect } from 'vitest';
import { groupByPhase, buildMethodologySections } from '../../src/methodologyViewModel.js';
import type { MethodologyItem } from '../../src/types.js';

function item(phase: string, name: string, overrides?: Partial<MethodologyItem>): MethodologyItem {
  return { skill: `bmad-${name}`, displayName: name, menuCode: '', description: '', required: false, priority: 'optional', category: 'workflow', phase, module: 'BMad Method', agentName: '', ...overrides };
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
      '1-discovery', '2-planning', '4-implementation', 'anytime',
    ]);
  });

  it('returns empty array for no items', () => {
    expect(groupByPhase([])).toEqual([]);
  });
});

describe('buildMethodologySections', () => {
  it('separates items into three sections', () => {
    const items: MethodologyItem[] = [
      item('1-analysis', 'brainstorm'),
      item('agent', 'write', { agentName: 'bmad-agent-tech-writer', category: 'agent' }),
      item('anytime', 'help', { module: 'Core' }),
    ];

    const sections = buildMethodologySections(items);
    expect(sections).toHaveLength(3);
    expect(sections[0].kind).toBe('phase-workflows');
    expect(sections[1].kind).toBe('agents');
    expect(sections[2].kind).toBe('general');
  });

  it('groups phase items by phase in correct order', () => {
    const items: MethodologyItem[] = [
      item('4-implementation', 'dev-story'),
      item('1-analysis', 'brainstorm'),
      item('2-planning', 'create-prd'),
    ];

    const sections = buildMethodologySections(items);
    const phaseSection = sections.find(s => s.kind === 'phase-workflows')!;
    expect(phaseSection.groups!.map(g => g.phase)).toEqual(['1-discovery', '2-planning', '4-implementation']);
  });

  it('lists all agent items flat under agents section', () => {
    const items: MethodologyItem[] = [
      item('agent', 'analyst', { agentName: 'bmad-agent-analyst', category: 'agent' }),
      item('agent', 'dev', { agentName: 'bmad-agent-dev', category: 'agent' }),
    ];

    const sections = buildMethodologySections(items);
    const agentSection = sections.find(s => s.kind === 'agents')!;
    expect(agentSection.items).toHaveLength(2);
    expect(agentSection.items!.map(i => i.agentName)).toEqual([
      'bmad-agent-analyst', 'bmad-agent-dev',
    ]);
  });

  it('sub-groups general items by module', () => {
    const items: MethodologyItem[] = [
      item('anytime', 'help', { module: 'Core' }),
      item('anytime', 'quick-dev', { module: 'BMad Method' }),
    ];

    const sections = buildMethodologySections(items);
    const generalSection = sections.find(s => s.kind === 'general')!;
    expect(generalSection.groups).toHaveLength(2);
    expect(generalSection.groups![0].displayName).toBe('BMad Method');
    expect(generalSection.groups![1].displayName).toBe('Core');
  });

  it('omits empty sections', () => {
    const items: MethodologyItem[] = [item('1-analysis', 'brainstorm')];
    const sections = buildMethodologySections(items);
    expect(sections).toHaveLength(1);
    expect(sections[0].kind).toBe('phase-workflows');
  });

  it('returns empty array for no items', () => {
    expect(buildMethodologySections([])).toEqual([]);
  });

  it('maps legacy phase aliases correctly', () => {
    const items: MethodologyItem[] = [
      item('1-analysis', 'brainstorm'),
      item('3-solutioning', 'architecture'),
    ];
    const sections = buildMethodologySections(items);
    const phaseSection = sections.find(s => s.kind === 'phase-workflows')!;
    expect(phaseSection.groups!.map(g => g.phase)).toEqual(['1-discovery', '3-solution-design']);
  });
});
