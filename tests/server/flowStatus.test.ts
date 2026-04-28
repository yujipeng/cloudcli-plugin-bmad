import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';

let serverProcess: ChildProcessByStdio<null, Readable, Readable>;
let port = 0;
let tmpDir = '';

async function requestJson(urlPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${urlPath}`, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
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
      const text = chunk.toString().trim();
      try {
        const parsed = JSON.parse(text);
        if (parsed.ready && parsed.port) {
          clearTimeout(timer);
          resolve(parsed.port);
        }
      } catch {
        // ignore non-json output
      }
    });
    serverProcess.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      if (text.includes('Error') || text.includes('ERR_')) {
        clearTimeout(timer);
        reject(new Error(text));
      }
    });
  });
}, 15000);

afterAll(() => {
  serverProcess.kill();
});

function makeBmadDir(base: string) {
  const bmadDir = path.join(base, '_bmad', 'bmm');
  fs.mkdirSync(bmadDir, { recursive: true });
  fs.writeFileSync(path.join(bmadDir, 'config.yaml'), [
    'project_name: test',
    'planning_artifacts: "{project-root}/docs/planning-artifacts"',
    'implementation_artifacts: "{project-root}/docs/implementation-artifacts"',
  ].join('\n'));
}

function makeSprintYaml(options?: {
  storyStatus?: 'ready-for-dev' | 'review' | 'done';
  retroStatus?: 'optional' | 'done';
}): string {
  const storyStatus = options?.storyStatus ?? 'done';
  const retroStatus = options?.retroStatus ?? 'done';
  const epicStatus = storyStatus === 'done' ? 'done' : 'in-progress';

  return [
    'project: test',
    'development_status:',
    `  epic-1: ${epicStatus}`,
    `  1-1-story: ${storyStatus}`,
    `  epic-1-retrospective: ${retroStatus}`,
  ].join('\n');
}

function makeCompletedSprintYaml(): string {
  return makeSprintYaml();
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-flow-'));
  makeBmadDir(tmpDir);

  const planDir = path.join(tmpDir, 'docs', 'planning-artifacts');
  const implDir = path.join(tmpDir, 'docs', 'implementation-artifacts');
  fs.mkdirSync(planDir, { recursive: true });
  fs.mkdirSync(implDir, { recursive: true });

  fs.writeFileSync(path.join(planDir, 'prd.md'), '# PRD');
  fs.writeFileSync(path.join(planDir, 'epics.md'), '# Epics');
  fs.writeFileSync(path.join(planDir, 'architecture.md'), '# Architecture');
  fs.writeFileSync(path.join(implDir, 'sprint-status.yaml'), makeCompletedSprintYaml());
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('/flow status after retrospectives complete', () => {
  it('marks retrospective phase as done when all epic retrospectives are done', async () => {
    const data = await requestJson(`/flow?path=${encodeURIComponent(tmpDir)}`);

    const retrospective = data.phases.find((phase: { phase: string; status: string }) => phase.phase === 'retrospective');
    expect(retrospective?.status).toBe('done');
  });

  it('returns no next action when sprint and retrospectives are fully complete', async () => {
    const data = await requestJson(`/flow?path=${encodeURIComponent(tmpDir)}`);

    expect(data.nextAction).toBeNull();
  });

  it('does not fall back to discovery actions after retrospective is complete', async () => {
    fs.rmSync(path.join(tmpDir, 'docs', 'planning-artifacts', 'prd.md'));

    const data = await requestJson(`/flow?path=${encodeURIComponent(tmpDir)}`);

    expect(data.nextAction).toBeNull();
  });

  it('prefers development actions once sprint work has started even when early docs are missing', async () => {
    fs.rmSync(path.join(tmpDir, 'docs', 'planning-artifacts', 'prd.md'));
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'implementation-artifacts', 'sprint-status.yaml'),
      makeSprintYaml({ storyStatus: 'ready-for-dev', retroStatus: 'optional' }),
    );

    const data = await requestJson(`/flow?path=${encodeURIComponent(tmpDir)}`);

    expect(data.nextAction?.command).toBe('/bmad-dev-story');
  });

  it('keeps design recommendations when sprint status has no epics', async () => {
    fs.rmSync(path.join(tmpDir, 'docs', 'planning-artifacts', 'architecture.md'));
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'implementation-artifacts', 'sprint-status.yaml'),
      'project: test',
    );

    const data = await requestJson(`/flow?path=${encodeURIComponent(tmpDir)}`);

    expect(data.nextAction?.command).toBe('/bmad-create-architecture');
  });

  it('keeps discovery recommendation when no later-stage evidence exists', async () => {
    fs.rmSync(path.join(tmpDir, 'docs', 'planning-artifacts', 'prd.md'));
    fs.rmSync(path.join(tmpDir, 'docs', 'planning-artifacts', 'epics.md'));
    fs.rmSync(path.join(tmpDir, 'docs', 'planning-artifacts', 'architecture.md'));
    fs.rmSync(path.join(tmpDir, 'docs', 'implementation-artifacts', 'sprint-status.yaml'));

    const data = await requestJson(`/flow?path=${encodeURIComponent(tmpDir)}`);

    expect(data.nextAction?.command).toBe('/bmad-product-brief');
  });
});
