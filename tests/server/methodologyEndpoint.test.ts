import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseMethodologyCsv } from '../../src/methodologyParser.js';
import { buildMethodologySections } from '../../src/methodologyViewModel.js';
import type { MethodologyResponse } from '../../src/types.js';

function getMethodologyData(projectPath: string): MethodologyResponse {
  const p = path.resolve(projectPath);
  if (!fs.existsSync(p)) return { sections: [], error: 'Path does not exist' };

  const csvPath = path.join(p, '_bmad', '_config', 'bmad-help.csv');

  if (!fs.existsSync(path.join(p, '_bmad'))) {
    return { sections: [], warning: 'no bmad directory' };
  }
  if (!fs.existsSync(csvPath)) {
    return { sections: [], warning: 'methodology file not found' };
  }

  let csvContent: string;
  try {
    csvContent = fs.readFileSync(csvPath, 'utf-8');
  } catch {
    return { sections: [], error: 'permission denied' };
  }

  const items = parseMethodologyCsv(csvContent);
  const sections = buildMethodologySections(items);
  return { sections };
}

describe('GET /methodology logic', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns warning when path has no _bmad directory', () => {
    const result = getMethodologyData(tmpDir);
    expect(result.sections).toEqual([]);
    expect(result.warning).toBe('no bmad directory');
  });

  it('returns warning when csv file not found', () => {
    fs.mkdirSync(path.join(tmpDir, '_bmad', '_config'), { recursive: true });
    const result = getMethodologyData(tmpDir);
    expect(result.warning).toBe('methodology file not found');
  });

  it('returns sectioned data for valid csv', () => {
    const csvDir = path.join(tmpDir, '_bmad', '_config');
    fs.mkdirSync(csvDir, { recursive: true });
    const csv = [
      'module,phase,name,code,sequence,workflow-file,command,required,agent-name,agent-command,agent-display-name,agent-title,options,description,output-location,outputs',
      'BMad Method,1-analysis,Brainstorm,BP,,bmad-brainstorming,,false,,,,,false,Expert guided.,planning_artifacts,session',
      'BMad Method,anytime,Help,BH,,bmad-help,,false,,,,,false,Get help.,,',
    ].join('\n');
    fs.writeFileSync(path.join(csvDir, 'bmad-help.csv'), csv, 'utf-8');

    const result = getMethodologyData(tmpDir);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].kind).toBe('phase-workflows');
    expect(result.sections[1].kind).toBe('general');
  });

  it('returns error for nonexistent path', () => {
    const result = getMethodologyData('/nonexistent/path/xyz');
    expect(result.error).toBeDefined();
  });

  it('sections are ordered correctly', () => {
    const csvDir = path.join(tmpDir, '_bmad', '_config');
    fs.mkdirSync(csvDir, { recursive: true });
    const csv = [
      'module,phase,name,code,sequence,workflow-file,command,required,agent-name,agent-command,agent-display-name,agent-title,options,description,output-location,outputs',
      'Core,anytime,Help,BH,,bmad-help,,false,,,,,false,,,',
      'BMad Method,2-planning,PRD,CP,,bmad-create-prd,,true,,,,,false,Create PRD.,planning_artifacts,prd',
      'BMad Method,1-analysis,Research,DR,,bmad-domain-research,,false,,,,,false,Research.,planning_artifacts,docs',
      'BMad Method,bmad-agent-tech-writer,Write,WD,"Write docs",write,,anytime,,,,,,false,project-knowledge,document',
    ].join('\n');
    fs.writeFileSync(path.join(csvDir, 'bmad-help.csv'), csv, 'utf-8');

    const result = getMethodologyData(tmpDir);
    expect(result.sections.map(s => s.kind)).toEqual(['phase-workflows', 'agents', 'general']);
  });
});
