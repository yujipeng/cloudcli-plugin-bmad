import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { archiveCurrentWorkspace } from '../../src/archiveExecutor.js';

let tmpDir = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-archive-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function setupCurrentWorkspace() {
  const planDir = path.join(tmpDir, 'docs', 'planning-artifacts');
  const implDir = path.join(tmpDir, 'docs', 'implementation-artifacts');
  fs.mkdirSync(planDir, { recursive: true });
  fs.mkdirSync(implDir, { recursive: true });
  fs.writeFileSync(path.join(planDir, 'prd.md'), '# PRD');
  fs.writeFileSync(path.join(implDir, 'sprint-status.yaml'), 'project: test');
  return { planDir, implDir };
}

describe('archiveCurrentWorkspace', () => {
  it('archives current workspace to v1', () => {
    const { planDir, implDir } = setupCurrentWorkspace();
    const targetDir = path.join(tmpDir, 'docs', 'v1');

    const result = archiveCurrentWorkspace(planDir, implDir, targetDir);

    expect(result.success).toBe(true);
    expect(result.targetVersion).toBe('v1');
    expect(fs.existsSync(path.join(targetDir, 'planning-artifacts', 'prd.md'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'implementation-artifacts', 'sprint-status.yaml'))).toBe(true);
  });

  it('rebuilds empty current workspace after archive', () => {
    const { planDir, implDir } = setupCurrentWorkspace();
    const targetDir = path.join(tmpDir, 'docs', 'v1');

    archiveCurrentWorkspace(planDir, implDir, targetDir);

    expect(fs.existsSync(planDir)).toBe(true);
    expect(fs.existsSync(implDir)).toBe(true);
    expect(fs.readdirSync(planDir)).toHaveLength(0);
    expect(fs.readdirSync(implDir)).toHaveLength(0);
  });

  it('refuses to archive when target version exists', () => {
    const { planDir, implDir } = setupCurrentWorkspace();
    const targetDir = path.join(tmpDir, 'docs', 'v1');
    fs.mkdirSync(targetDir, { recursive: true });

    const result = archiveCurrentWorkspace(planDir, implDir, targetDir);

    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
    expect(fs.existsSync(path.join(planDir, 'prd.md'))).toBe(true);
  });

  it('refuses when current workspace is missing', () => {
    const planDir = path.join(tmpDir, 'docs', 'planning-artifacts');
    const implDir = path.join(tmpDir, 'docs', 'implementation-artifacts');
    const targetDir = path.join(tmpDir, 'docs', 'v1');

    const result = archiveCurrentWorkspace(planDir, implDir, targetDir);

    expect(result.success).toBe(false);
    expect(result.error).toContain('missing');
  });
});
