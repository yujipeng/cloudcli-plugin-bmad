import { describe, it, expect } from 'vitest';
import { parseMethodologyCsv } from '../../src/methodologyParser.js';

// New 13-column format: module,skill,display-name,menu-code,description,action,args,phase,after,before,required,output-location,outputs
const HEADER = 'module,skill,display-name,menu-code,description,action,args,phase,after,before,required,output-location,outputs';

describe('parseMethodologyCsv', () => {
  it('parses a normal CSV row into MethodologyItem', () => {
    const csv = [
      HEADER,
      'BMad Method,bmad-brainstorming,Brainstorm Project,BP,Expert guided facilitation.,,,1-analysis,,,false,planning_artifacts,brainstorming session',
    ].join('\n');

    const items = parseMethodologyCsv(csv);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      skill: 'bmad-brainstorming',
      displayName: 'Brainstorm Project',
      menuCode: 'BP',
      description: 'Expert guided facilitation.',
      required: false,
      priority: 'optional',
      category: 'workflow',
      phase: '1-analysis',
      module: 'BMad Method',
      agentName: '',
    });
  });

  it('filters out _meta rows', () => {
    const csv = [
      HEADER,
      'BMad Method,_meta,,,,,,,,,false,https://docs.bmad-method.org/llms.txt,',
      'BMad Method,bmad-help,BMad Help,BH,,,anytime,,,false,,',
    ].join('\n');

    const items = parseMethodologyCsv(csv);
    expect(items).toHaveLength(1);
    expect(items[0].skill).toBe('bmad-help');
  });

  it('uses default values for missing columns', () => {
    const csv = [
      HEADER,
      'BMad Method,bmad-foo',
    ].join('\n');

    const items = parseMethodologyCsv(csv);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      skill: 'bmad-foo',
      displayName: '',
      menuCode: '',
      description: '',
      required: false,
      priority: 'optional',
      phase: 'anytime',
    });
  });

  it('detects agent category from skill name prefix', () => {
    const csv = [
      HEADER,
      'BMad Method,bmad-agent-tech-writer,Write Document,WD,Write docs.,write,,anytime,,,false,project-knowledge,document',
    ].join('\n');

    const items = parseMethodologyCsv(csv);
    expect(items[0].category).toBe('agent');
    expect(items[0].agentName).toBe('bmad-agent-tech-writer');
    expect(items[0].phase).toBe('agent');
  });

  it('parses module field correctly', () => {
    const csv = [
      HEADER,
      'Core,bmad-help,BMad Help,BH,Get help.,,,anytime,,,false,,',
    ].join('\n');

    const items = parseMethodologyCsv(csv);
    expect(items[0].module).toBe('Core');
  });

  it('parses required=true correctly', () => {
    const csv = [
      HEADER,
      'BMad Method,bmad-create-architecture,Create Architecture,CA,Guided workflow.,,,3-solutioning,,,true,planning_artifacts,architecture',
    ].join('\n');

    const items = parseMethodologyCsv(csv);
    expect(items[0].required).toBe(true);
    expect(items[0].priority).toBe('required');
  });

  it('parses required=recommended correctly', () => {
    const csv = [
      HEADER,
      'BMad Method,bmad-domain-research,Domain Research,DR,Deep dive.,,,1-analysis,,,recommended,planning_artifacts,research',
    ].join('\n');

    const items = parseMethodologyCsv(csv);
    expect(items[0].required).toBe(false);
    expect(items[0].priority).toBe('recommended');
  });

  it('handles CSV with quoted fields containing commas', () => {
    const csv = [
      HEADER,
      'BMad Method,bmad-quick-dev,Quick Dev,QQ,"Unified intent-in, code-out workflow.",,,anytime,,,false,implementation_artifacts,spec',
    ].join('\n');

    const items = parseMethodologyCsv(csv);
    expect(items[0].description).toBe('Unified intent-in, code-out workflow.');
  });

  it('returns empty array for empty input', () => {
    expect(parseMethodologyCsv('')).toEqual([]);
  });

  it('skips blank lines', () => {
    const csv = [HEADER, '', 'BMad Method,bmad-help,Help,BH,,,anytime,,,false,,', ''].join('\n');
    const items = parseMethodologyCsv(csv);
    expect(items).toHaveLength(1);
  });

  it('uses phase from col(7) correctly', () => {
    const csv = [
      HEADER,
      'BMad Method,bmad-create-prd,Create PRD,CP,Expert led facilitation.,,,2-planning,,,true,planning_artifacts,prd',
    ].join('\n');

    const items = parseMethodologyCsv(csv);
    expect(items[0].phase).toBe('2-planning');
    expect(items[0].skill).toBe('bmad-create-prd');
  });
});
