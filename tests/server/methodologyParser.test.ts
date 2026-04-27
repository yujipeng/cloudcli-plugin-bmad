import { describe, it, expect } from 'vitest';
import { parseMethodologyCsv } from '../../src/methodologyParser.js';

const HEADER = 'module,phase,name,code,sequence,workflow-file,command,required,agent-name,agent-command,agent-display-name,agent-title,options,description,output-location,outputs';

describe('parseMethodologyCsv', () => {
  it('parses a normal CSV row into MethodologyItem', () => {
    const csv = [
      HEADER,
      'BMad Method,1-analysis,Brainstorm Project,BP,,bmad-brainstorming,,false,,,,,false,Expert guided facilitation.,planning_artifacts,brainstorming session',
    ].join('\n');

    const items = parseMethodologyCsv(csv);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      skill: 'bmad-brainstorming',
      displayName: 'Brainstorm Project',
      menuCode: 'BP',
      description: 'Expert guided facilitation.',
      required: false,
      category: 'workflow',
      phase: '1-analysis',
      module: 'BMad Method',
      agentName: '',
    });
  });

  it('filters out _meta rows', () => {
    const csv = [
      HEADER,
      'BMad Method,_meta,,,,,,false,,,,,,,https://docs.bmad-method.org/llms.txt,',
      'BMad Method,anytime,BMad Help,BH,,bmad-help,,false,,,,,false,,,',
    ].join('\n');

    const items = parseMethodologyCsv(csv);
    expect(items).toHaveLength(1);
    expect(items[0].skill).toBe('bmad-help');
  });

  it('uses default values for missing columns', () => {
    const csv = [
      HEADER,
      'BMad Method,2-planning',
    ].join('\n');

    const items = parseMethodologyCsv(csv);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      displayName: '',
      menuCode: '',
      description: '',
      required: false,
      category: 'tool',
      phase: '2-planning',
    });
  });

  it('detects agent category from agent-name field', () => {
    const csv = [
      HEADER,
      'BMad Method,anytime,Write Document,WD,,bmad-agent-tech-writer,,false,tech-writer,,,,,Write docs.,project-knowledge,document',
    ].join('\n');

    const items = parseMethodologyCsv(csv);
    expect(items[0].category).toBe('agent');
  });

  it('detects agent-name-as-phase pattern and normalizes phase', () => {
    const csv = [
      HEADER,
      'BMad Method,bmad-agent-tech-writer,Write Document,WD,"Describe in detail",write,,anytime,,,,,,false,project-knowledge,document',
    ].join('\n');

    const items = parseMethodologyCsv(csv);
    expect(items[0].phase).toBe('agent');
    expect(items[0].agentName).toBe('bmad-agent-tech-writer');
    expect(items[0].skill).toBe('write');
  });

  it('parses module field correctly', () => {
    const csv = [
      HEADER,
      'Core,anytime,BMad Help,BH,,bmad-help,,false,,,,,false,,,',
    ].join('\n');

    const items = parseMethodologyCsv(csv);
    expect(items[0].module).toBe('Core');
  });

  it('parses required=true correctly', () => {
    const csv = [
      HEADER,
      'BMad Method,3-solutioning,Create Architecture,CA,,bmad-create-architecture,,true,,,,,false,Guided workflow.,planning_artifacts,architecture',
    ].join('\n');

    const items = parseMethodologyCsv(csv);
    expect(items[0].required).toBe(true);
  });

  it('handles CSV with quoted fields containing commas', () => {
    const csv = [
      HEADER,
      'BMad Method,anytime,Quick Dev,QQ,,bmad-quick-dev,,false,,,,,false,"Unified intent-in, code-out workflow.",implementation_artifacts,spec',
    ].join('\n');

    const items = parseMethodologyCsv(csv);
    expect(items[0].description).toBe('Unified intent-in, code-out workflow.');
  });

  it('returns empty array for empty input', () => {
    expect(parseMethodologyCsv('')).toEqual([]);
  });

  it('skips blank lines', () => {
    const csv = [HEADER, '', 'BMad Method,anytime,Help,BH,,bmad-help,,false,,,,,false,,,', ''].join('\n');
    const items = parseMethodologyCsv(csv);
    expect(items).toHaveLength(1);
  });
});
