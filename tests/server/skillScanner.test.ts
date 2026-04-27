import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { scanSkills } from '../../src/skillScanner.js';

describe('scanSkills', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-skill-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeSkill(name: string, description: string) {
    const dir = path.join(tmpDir, '.claude', 'skills', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\n---\n# ${name}\n`, 'utf-8');
  }

  it('scans SKILL.md files and returns MethodologyItems', () => {
    writeSkill('bmad-create-prd', 'Create a PRD from scratch.');
    writeSkill('bmad-agent-dev', 'Senior software engineer.');

    const items = scanSkills(tmpDir);
    expect(items).toHaveLength(2);

    const prd = items.find(i => i.skill === 'bmad-create-prd')!;
    expect(prd.phase).toBe('2-planning');
    expect(prd.category).toBe('workflow');
    expect(prd.description).toBe('Create a PRD from scratch.');

    const dev = items.find(i => i.skill === 'bmad-agent-dev')!;
    expect(dev.phase).toBe('agent');
    expect(dev.category).toBe('agent');
    expect(dev.agentName).toBe('bmad-agent-dev');
  });

  it('defaults unknown skills to general phase', () => {
    writeSkill('bmad-unknown-skill', 'Some unknown skill.');
    const items = scanSkills(tmpDir);
    expect(items).toHaveLength(1);
    expect(items[0].phase).toBe('general');
  });

  it('skips SKILL.md without valid frontmatter', () => {
    const dir = path.join(tmpDir, '.claude', 'skills', 'bad-skill');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), '# No frontmatter here\n', 'utf-8');

    const items = scanSkills(tmpDir);
    expect(items).toHaveLength(0);
  });

  it('returns empty array for nonexistent skills directory', () => {
    const items = scanSkills('/nonexistent/path/xyz');
    expect(items).toEqual([]);
  });

  it('returns empty array when .claude/skills is empty', () => {
    fs.mkdirSync(path.join(tmpDir, '.claude', 'skills'), { recursive: true });
    const items = scanSkills(tmpDir);
    expect(items).toEqual([]);
  });

  it('skips directories without SKILL.md', () => {
    const dir = path.join(tmpDir, '.claude', 'skills', 'no-skill-file');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'README.md'), '# readme', 'utf-8');

    const items = scanSkills(tmpDir);
    expect(items).toEqual([]);
  });
});
