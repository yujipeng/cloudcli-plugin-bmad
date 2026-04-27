import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import path from 'node:path';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';

let serverProcess: ChildProcessByStdio<null, Readable, Readable>;
let port = 0;

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

describe('/flow status after retrospectives complete', () => {
  it('marks retrospective phase as done when all epic retrospectives are done', async () => {
    const repoPath = path.resolve(process.cwd());
    const data = await requestJson(`/flow?path=${encodeURIComponent(repoPath)}`);

    const retrospective = data.phases.find((phase: { phase: string; status: string }) => phase.phase === 'retrospective');
    expect(retrospective?.status).toBe('done');
  });

  it('returns no next action when sprint and retrospectives are fully complete', async () => {
    const repoPath = path.resolve(process.cwd());
    const data = await requestJson(`/flow?path=${encodeURIComponent(repoPath)}`);

    expect(data.nextAction).toBeNull();
  });
});
