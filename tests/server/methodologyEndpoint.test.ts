import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseMethodologyCsv } from '../../src/methodologyParser.js';
import { buildMethodologySections } from '../../src/methodologyViewModel.js';
import type { MethodologyResponse } from '../../src/types.js';

const NEW_HEADER = 'module,skill,display-name,menu-code,description,action,args,phase,after,before,required,output-location,outputs';

function getMethodologyData(projectPath: string): MethodologyResponse {
  const p = path.resolve(projectPath);
  if (!fs.existsSync(p)) return { sections: [], error: 'Path does not exist' };

  const csvPath = path.join(p, '_bmad', 'module-help.csv');

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
    fs.mkdirSync(path.join(tmpDir, '_bmad'), { recursive: true });
    const result = getMethodologyData(tmpDir);
    expect(result.warning).toBe('methodology file not found');
  });

  it('returns sectioned data for valid csv', () => {
    const bmadDir = path.join(tmpDir, '_bmad');
    fs.mkdirSync(bmadDir, { recursive: true });
    const csv = [
      NEW_HEADER,
      'BMad Method,bmad-brainstorming,Brainstorm,BP,Expert guided.,,,1-analysis,,,false,planning_artifacts,session',
      'BMad Method,bmad-help,Help,BH,Get help.,,,anytime,,,false,,',
    ].join('\n');
    fs.writeFileSync(path.join(bmadDir, 'module-help.csv'), csv, 'utf-8');

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
    const bmadDir = path.join(tmpDir, '_bmad');
    fs.mkdirSync(bmadDir, { recursive: true });
    const csv = [
      NEW_HEADER,
      'Core,bmad-help,Help,BH,,,anytime,,,false,,',
      'BMad Method,bmad-create-prd,PRD,CP,Create PRD.,,,2-planning,,,true,planning_artifacts,prd',
      'BMad Method,bmad-domain-research,Research,DR,Research.,,,1-analysis,,,false,planning_artifacts,docs',
      'BMad Method,bmad-agent-tech-writer,Write,WD,Write docs.,write,,anytime,,,false,project-knowledge,document',
    ].join('\n');
    fs.writeFileSync(path.join(bmadDir, 'module-help.csv'), csv, 'utf-8');

    const result = getMethodologyData(tmpDir);
    expect(result.sections.map(s => s.kind)).toEqual(['phase-workflows', 'agents', 'general']);
  });
});
