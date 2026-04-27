import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';

let serverProcess: ChildProcessByStdio<null, Readable, Readable>;
let port = 0;
let tmpDir = '';

async function requestJson(urlPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${urlPath}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

beforeAll(async () => {
  serverProcess = spawn('npx', ['tsx', 'src/server.ts'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server start timeout')), 10000);
    serverProcess.stdout.on('data', (chunk) => {
      try {
        const parsed = JSON.parse(chunk.toString().trim());
        if (parsed.ready && parsed.port) { clearTimeout(timer); resolve(parsed.port); }
      } catch { /* ignore */ }
    });
    serverProcess.stderr.on('data', (chunk) => {
      if (chunk.toString().includes('Error')) { clearTimeout(timer); reject(new Error(chunk.toString())); }
    });
  });
}, 15000);

afterAll(() => { serverProcess.kill(); });

function makeBmadDir(base: string) {
  const bmadDir = path.join(base, '_bmad', 'bmm');
  fs.mkdirSync(bmadDir, { recursive: true });
  fs.writeFileSync(path.join(bmadDir, 'config.yaml'), [
    `project_name: test`,
    `planning_artifacts: "{project-root}/docs/planning-artifacts"`,
    `implementation_artifacts: "{project-root}/docs/implementation-artifacts"`,
  ].join('\n'));
}

function makeSprintYaml(epicsDone: boolean): string {
  const status = epicsDone ? 'done' : 'in-progress';
  return [
    'project: test',
    'development_status:',
    `  epic-1: ${status}`,
    `  1-1-story: ${epicsDone ? 'done' : 'in-progress'}`,
  ].join('\n');
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-ver-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('/versions endpoint', () => {
  it('returns unversioned for flat artifact structure', async () => {
    makeBmadDir(tmpDir);
    const planDir = path.join(tmpDir, 'docs', 'planning-artifacts');
    fs.mkdirSync(planDir, { recursive: true });
    fs.writeFileSync(path.join(planDir, 'prd.md'), '# PRD');

    const data = await requestJson(`/versions?path=${encodeURIComponent(tmpDir)}`);
    expect(data.unversioned).toBe(true);
    expect(data.versions).toHaveLength(1);
    expect(data.versions[0].version.id).toBe('__unversioned__');
  });

  it('discovers v1 and v2 directories', async () => {
    makeBmadDir(tmpDir);
    for (const v of ['v1', 'v2']) {
      const planDir = path.join(tmpDir, 'docs', v, 'planning-artifacts');
      fs.mkdirSync(planDir, { recursive: true });
      fs.writeFileSync(path.join(planDir, 'prd.md'), '# PRD');
    }

    const data = await requestJson(`/versions?path=${encodeURIComponent(tmpDir)}`);
    expect(data.unversioned).toBe(false);
    expect(data.versions).toHaveLength(2);
    expect(data.versions[0].version.id).toBe('v1');
    expect(data.versions[1].version.id).toBe('v2');
  });

  it('skips version dirs without artifact subdirectories', async () => {
    makeBmadDir(tmpDir);
    fs.mkdirSync(path.join(tmpDir, 'docs', 'v1', 'planning-artifacts'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'docs', 'v2'), { recursive: true }); // no artifacts inside
    fs.writeFileSync(path.join(tmpDir, 'docs', 'v1', 'planning-artifacts', 'prd.md'), '# PRD');

    const data = await requestJson(`/versions?path=${encodeURIComponent(tmpDir)}`);
    expect(data.versions).toHaveLength(1);
    expect(data.versions[0].version.id).toBe('v1');
  });

  it('computes independent phase status per version', async () => {
    makeBmadDir(tmpDir);
    // v1: has prd + epics + architecture + sprint (complete)
    const v1Plan = path.join(tmpDir, 'docs', 'v1', 'planning-artifacts');
    const v1Impl = path.join(tmpDir, 'docs', 'v1', 'implementation-artifacts');
    fs.mkdirSync(v1Plan, { recursive: true });
    fs.mkdirSync(v1Impl, { recursive: true });
    fs.writeFileSync(path.join(v1Plan, 'prd.md'), '# PRD');
    fs.writeFileSync(path.join(v1Plan, 'epics.md'), '# Epics');
    fs.writeFileSync(path.join(v1Plan, 'architecture.md'), '# Arch');
    fs.writeFileSync(path.join(v1Impl, 'sprint-status.yaml'), makeSprintYaml(true));

    // v2: only has prd
    const v2Plan = path.join(tmpDir, 'docs', 'v2', 'planning-artifacts');
    fs.mkdirSync(v2Plan, { recursive: true });
    fs.writeFileSync(path.join(v2Plan, 'prd.md'), '# PRD v2');

    const data = await requestJson(`/versions?path=${encodeURIComponent(tmpDir)}`);
    expect(data.versions).toHaveLength(2);

    const v1 = data.versions[0];
    const v2 = data.versions[1];
    expect(v1.phases.find((p: any) => p.phase === 'design').status).toBe('done');
    expect(v2.phases.find((p: any) => p.phase === 'design').status).toBe('pending');
  });

  it('sets activeVersionId to the version with active phases', async () => {
    makeBmadDir(tmpDir);
    // v1: complete
    const v1Plan = path.join(tmpDir, 'docs', 'v1', 'planning-artifacts');
    const v1Impl = path.join(tmpDir, 'docs', 'v1', 'implementation-artifacts');
    fs.mkdirSync(v1Plan, { recursive: true });
    fs.mkdirSync(v1Impl, { recursive: true });
    fs.writeFileSync(path.join(v1Plan, 'prd.md'), '');
    fs.writeFileSync(path.join(v1Plan, 'epics.md'), '');
    fs.writeFileSync(path.join(v1Plan, 'architecture.md'), '');
    fs.writeFileSync(path.join(v1Impl, 'sprint-status.yaml'), makeSprintYaml(true));

    // v2: in progress
    const v2Plan = path.join(tmpDir, 'docs', 'v2', 'planning-artifacts');
    fs.mkdirSync(v2Plan, { recursive: true });
    fs.writeFileSync(path.join(v2Plan, 'prd.md'), '');

    const data = await requestJson(`/versions?path=${encodeURIComponent(tmpDir)}`);
    expect(data.activeVersionId).toBe('v2');
  });
});

describe('multi-sprint within a version', () => {
  it('discovers multiple sprint-status files', async () => {
    makeBmadDir(tmpDir);
    const v1Plan = path.join(tmpDir, 'docs', 'v1', 'planning-artifacts');
    const v1Impl = path.join(tmpDir, 'docs', 'v1', 'implementation-artifacts');
    fs.mkdirSync(v1Plan, { recursive: true });
    fs.mkdirSync(v1Impl, { recursive: true });
    fs.writeFileSync(path.join(v1Plan, 'prd.md'), '');
    fs.writeFileSync(path.join(v1Plan, 'epics.md'), '');
    fs.writeFileSync(path.join(v1Impl, 'sprint-status.yaml'), makeSprintYaml(true));
    fs.writeFileSync(path.join(v1Impl, 'sprint-status-2.yaml'), makeSprintYaml(false));

    const data = await requestJson(`/versions?path=${encodeURIComponent(tmpDir)}`);
    const v1 = data.versions[0];
    expect(v1.sprints).toHaveLength(2);
    expect(v1.sprints[0].sprintNumber).toBe(1);
    expect(v1.sprints[1].sprintNumber).toBe(2);
    expect(v1.sprints[1].active).toBe(true);
    expect(v1.activeSprint).toBe(2);
  });

  it('marks last sprint active when all are done', async () => {
    makeBmadDir(tmpDir);
    const v1Plan = path.join(tmpDir, 'docs', 'v1', 'planning-artifacts');
    const v1Impl = path.join(tmpDir, 'docs', 'v1', 'implementation-artifacts');
    fs.mkdirSync(v1Plan, { recursive: true });
    fs.mkdirSync(v1Impl, { recursive: true });
    fs.writeFileSync(path.join(v1Plan, 'prd.md'), '');
    fs.writeFileSync(path.join(v1Impl, 'sprint-status.yaml'), makeSprintYaml(true));
    fs.writeFileSync(path.join(v1Impl, 'sprint-status-2.yaml'), makeSprintYaml(true));

    const data = await requestJson(`/versions?path=${encodeURIComponent(tmpDir)}`);
    const v1 = data.versions[0];
    expect(v1.sprints[1].active).toBe(true);
  });
});

describe('/flow endpoint backwards compatibility', () => {
  it('still works for the current project', async () => {
    const repoPath = path.resolve(process.cwd());
    const data = await requestJson(`/flow?path=${encodeURIComponent(repoPath)}`);
    expect(data.bmadDetected).toBe(true);
    expect(data.phases).toBeDefined();
  });
});
