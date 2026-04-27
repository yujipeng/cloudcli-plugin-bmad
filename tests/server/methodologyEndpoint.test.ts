import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseMethodologyCsv } from '../../src/methodologyParser.js';
import { groupByPhase } from '../../src/methodologyViewModel.js';
import type { MethodologyResponse } from '../../src/types.js';

function getMethodologyData(projectPath: string): MethodologyResponse {
  const p = path.resolve(projectPath);
  if (!fs.existsSync(p)) return { groups: [], error: 'Path does not exist' };

  const csvPath = path.join(p, '_bmad', '_config', 'bmad-help.csv');

  if (!fs.existsSync(path.join(p, '_bmad'))) {
    return { groups: [], warning: 'no bmad directory' };
  }
  if (!fs.existsSync(csvPath)) {
    return { groups: [], warning: 'methodology file not found' };
  }

  let csvContent: string;
  try {
    csvContent = fs.readFileSync(csvPath, 'utf-8');
  } catch {
    return { groups: [], error: 'permission denied' };
  }

  const items = parseMethodologyCsv(csvContent);
  const groups = groupByPhase(items);
  return { groups };
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
    expect(result.groups).toEqual([]);
    expect(result.warning).toBe('no bmad directory');
  });

  it('returns warning when csv file not found', () => {
    fs.mkdirSync(path.join(tmpDir, '_bmad', '_config'), { recursive: true });
    const result = getMethodologyData(tmpDir);
    expect(result.warning).toBe('methodology file not found');
  });

  it('returns grouped data for valid csv', () => {
    const csvDir = path.join(tmpDir, '_bmad', '_config');
    fs.mkdirSync(csvDir, { recursive: true });
    const csv = [
      'module,phase,name,code,sequence,workflow-file,command,required,agent-name,agent-command,agent-display-name,agent-title,options,description,output-location,outputs',
      'BMad Method,1-analysis,Brainstorm,BP,,bmad-brainstorming,,false,,,,,false,Expert guided.,planning_artifacts,session',
      'BMad Method,anytime,Help,BH,,bmad-help,,false,,,,,false,Get help.,,',
    ].join('\n');
    fs.writeFileSync(path.join(csvDir, 'bmad-help.csv'), csv, 'utf-8');

    const result = getMethodologyData(tmpDir);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].phase).toBe('1-analysis');
    expect(result.groups[1].phase).toBe('anytime');
    expect(result.groups[0].items[0].menuCode).toBe('BP');
  });

  it('returns error for nonexistent path', () => {
    const result = getMethodologyData('/nonexistent/path/xyz');
    expect(result.error).toBeDefined();
  });

  it('groups are ordered correctly', () => {
    const csvDir = path.join(tmpDir, '_bmad', '_config');
    fs.mkdirSync(csvDir, { recursive: true });
    const csv = [
      'module,phase,name,code,sequence,workflow-file,command,required,agent-name,agent-command,agent-display-name,agent-title,options,description,output-location,outputs',
      'BMad Method,anytime,Help,BH,,bmad-help,,false,,,,,false,,,',
      'BMad Method,2-planning,PRD,CP,,bmad-create-prd,,true,,,,,false,Create PRD.,planning_artifacts,prd',
      'BMad Method,1-analysis,Research,DR,,bmad-domain-research,,false,,,,,false,Research.,planning_artifacts,docs',
    ].join('\n');
    fs.writeFileSync(path.join(csvDir, 'bmad-help.csv'), csv, 'utf-8');

    const result = getMethodologyData(tmpDir);
    expect(result.groups.map(g => g.phase)).toEqual(['1-analysis', '2-planning', 'anytime']);
  });
});
