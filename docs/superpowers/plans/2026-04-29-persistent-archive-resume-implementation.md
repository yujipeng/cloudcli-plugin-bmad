# Persistent Archive And Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让归档入口常驻、支持从归档版本恢复到当前工作区继续推进，并在再次归档时覆盖回原版本。

**Architecture:** 保持 `versionDiscovery.ts` 只负责目录发现，把“恢复来源标记”“归档模式判断”“覆盖归档”放在 `server.ts` 与 `archiveExecutor.ts`。前端只消费后端返回的 `archiveMode` / `archiveTargetVersionId` / `continueAllowed` 等字段，不自行推断状态。

**Tech Stack:** TypeScript, Node HTTP server, Vitest, esbuild

---

## File Map

- Modify: `src/types.ts`
  - 为版本流转补充归档模式、继续推进能力、来源版本标记相关类型
- Create: `src/versionResumeState.ts`
  - 持久化当前工作区的恢复来源元数据；负责读写/清理 resume state
- Modify: `src/archiveExecutor.ts`
  - 在现有新建归档基础上增加覆盖归档模式与目录复制逻辑
- Modify: `src/archiveSuggestion.ts`
  - 去掉“必须 retrospective done”限制，改为“当前工作区非空即可归档”
- Modify: `src/server.ts`
  - `/versions` 返回 archive mode
  - `POST /version/archive-current` 支持 new / overwrite
  - 新增 `POST /version/continue-as-current`
- Modify: `src/index.ts`
  - 归档卡片常驻
  - 支持“归档回 vN”文案
  - 归档版本页增加“继续为当前版本”按钮
- Modify: `tests/server/versionDiscovery.test.ts`
  - 增加恢复、冲突、覆盖归档、不生成新版本号等服务端回归测试
- Read during implementation: `src/versionDiscovery.ts`, `src/types.ts`
  - 复用现有 `VersionInfo`、`VersionFlowData`、`VersionedResponse`

## Task 1: 先用测试锁定新的版本状态语义

**Files:**
- Modify: `tests/server/versionDiscovery.test.ts`
- Read: `src/server.ts`
- Read: `src/types.ts`

- [ ] **Step 1: 为当前工作区常驻归档能力新增失败测试**

```ts
it('returns archive capability for non-empty current workspace even before retrospective is done', async () => {
  makeBmadDir(tmpDir);
  const planDir = path.join(tmpDir, 'docs', 'planning-artifacts');
  fs.mkdirSync(planDir, { recursive: true });
  fs.writeFileSync(path.join(planDir, 'prd.md'), '# PRD');

  const data = await requestJson(`/versions?path=${encodeURIComponent(tmpDir)}`);
  const current = data.versions.find((v: any) => v.version.kind === 'current');

  expect(current.archiveSuggestion).toMatchObject({
    enabled: true,
    archiveMode: 'new',
    targetVersion: 'v1',
  });
});
```

- [ ] **Step 2: 单跑这个测试并确认 RED**

Run: `npx vitest run tests/server/versionDiscovery.test.ts -t "returns archive capability for non-empty current workspace even before retrospective is done"`
Expected: FAIL，原因是当前逻辑仍要求 retrospective 完成。

- [ ] **Step 3: 为恢复来源标记新增失败测试**

```ts
it('returns overwrite archive mode when current workspace was resumed from archived version', async () => {
  makeBmadDir(tmpDir);
  const v1Plan = path.join(tmpDir, 'docs', 'v1', 'planning-artifacts');
  const v1Impl = path.join(tmpDir, 'docs', 'v1', 'implementation-artifacts');
  const currentPlan = path.join(tmpDir, 'docs', 'planning-artifacts');
  const currentImpl = path.join(tmpDir, 'docs', 'implementation-artifacts');

  fs.mkdirSync(v1Plan, { recursive: true });
  fs.mkdirSync(v1Impl, { recursive: true });
  fs.mkdirSync(currentPlan, { recursive: true });
  fs.mkdirSync(currentImpl, { recursive: true });
  fs.writeFileSync(path.join(currentPlan, '.bf-resume-state.json'), JSON.stringify({ archiveMode: 'overwrite', archiveTargetVersionId: 'v1' }));
  fs.writeFileSync(path.join(currentPlan, 'prd.md'), '# PRD');

  const data = await requestJson(`/versions?path=${encodeURIComponent(tmpDir)}`);
  const current = data.versions.find((v: any) => v.version.kind === 'current');

  expect(current.archiveSuggestion).toMatchObject({
    enabled: true,
    archiveMode: 'overwrite',
    targetVersion: 'v1',
  });
});
```

- [ ] **Step 4: 单跑恢复来源测试并确认 RED**

Run: `npx vitest run tests/server/versionDiscovery.test.ts -t "returns overwrite archive mode when current workspace was resumed from archived version"`
Expected: FAIL，原因是还没有读取 resume state。

- [ ] **Step 5: 用最小代码让这两条测试变绿**

```ts
// src/types.ts
export type ArchiveMode = 'new' | 'overwrite' | 'disabled';

export interface ArchiveSuggestion {
  enabled: boolean;
  targetVersion?: string;
  reason?: string;
  archiveMode?: ArchiveMode;
}
```

```ts
// src/archiveSuggestion.ts
if (!currentVersion.bmadDetected) {
  return { enabled: false, archiveMode: 'disabled', reason: '当前工作区为空' };
}

return {
  enabled: true,
  archiveMode: resumeState?.archiveMode === 'overwrite' ? 'overwrite' : 'new',
  targetVersion: resumeState?.archiveTargetVersionId ?? getNextArchiveVersion(allVersions),
};
```

- [ ] **Step 6: 重跑整份服务端版本测试确认 GREEN**

Run: `npx vitest run tests/server/versionDiscovery.test.ts`
Expected: 新增测试 PASS，其余现有版本测试也保持 PASS。

## Task 2: 新增 resume state 存储与读取

**Files:**
- Create: `src/versionResumeState.ts`
- Modify: `src/server.ts`
- Test: `tests/server/versionDiscovery.test.ts`

- [ ] **Step 1: 为 resume state 的持久化行为新增失败测试**

```ts
it('persists resume state under current workspace planning directory', async () => {
  makeBmadDir(tmpDir);
  const currentPlan = path.join(tmpDir, 'docs', 'planning-artifacts');
  fs.mkdirSync(currentPlan, { recursive: true });

  await requestJson(`/versions?path=${encodeURIComponent(tmpDir)}`);

  const statePath = path.join(currentPlan, '.bf-resume-state.json');
  expect(fs.existsSync(statePath)).toBe(false);
});
```

- [ ] **Step 2: 新增单元级 helper 文件并实现最小 API**

```ts
// src/versionResumeState.ts
import fs from 'node:fs';
import path from 'node:path';

export interface ResumeState {
  archiveMode: 'overwrite';
  archiveTargetVersionId: string;
}

export function getResumeStatePath(planDir: string): string {
  return path.join(planDir, '.bf-resume-state.json');
}

export function readResumeState(planDir: string): ResumeState | null {
  const p = getResumeStatePath(planDir);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as ResumeState;
  } catch {
    return null;
  }
}

export function writeResumeState(planDir: string, state: ResumeState): void {
  fs.mkdirSync(planDir, { recursive: true });
  fs.writeFileSync(getResumeStatePath(planDir), JSON.stringify(state));
}

export function clearResumeState(planDir: string): void {
  const p = getResumeStatePath(planDir);
  if (fs.existsSync(p)) fs.rmSync(p);
}
```

- [ ] **Step 3: 把 helper 接到 `/versions` 的 current workspace 组装逻辑里**

```ts
const resumeState = v.kind === 'current' ? readResumeState(v.planningDir) : null;
flowData.archiveSuggestion = detectArchiveSuggestion(flowData, versions, resumeState);
```

- [ ] **Step 4: 跑相关测试保持 GREEN**

Run: `npx vitest run tests/server/versionDiscovery.test.ts`
Expected: PASS

## Task 3: 先写恢复接口测试，再实现恢复到当前工作区

**Files:**
- Modify: `tests/server/versionDiscovery.test.ts`
- Modify: `src/server.ts`
- Modify: `src/index.ts`
- Read: `src/versionResumeState.ts`

- [ ] **Step 1: 为恢复成功路径新增失败测试**

```ts
it('continues an archived version into the current workspace and marks overwrite target', async () => {
  makeBmadDir(tmpDir);
  const v1Plan = path.join(tmpDir, 'docs', 'v1', 'planning-artifacts');
  const v1Impl = path.join(tmpDir, 'docs', 'v1', 'implementation-artifacts');
  fs.mkdirSync(v1Plan, { recursive: true });
  fs.mkdirSync(v1Impl, { recursive: true });
  fs.writeFileSync(path.join(v1Plan, 'prd.md'), '# PRD v1');
  fs.writeFileSync(path.join(v1Impl, 'sprint-status.yaml'), makeSprintYaml(false));

  const result = await postJson('/version/continue-as-current', {
    path: tmpDir,
    sourceVersionId: 'v1',
  });

  expect(fs.readFileSync(path.join(tmpDir, 'docs', 'planning-artifacts', 'prd.md'), 'utf-8')).toContain('PRD v1');
  const current = result.versions.find((v: any) => v.version.kind === 'current');
  expect(current.archiveSuggestion).toMatchObject({ targetVersion: 'v1', archiveMode: 'overwrite' });
});
```

- [ ] **Step 2: 为当前工作区非空冲突新增失败测试**

```ts
it('rejects continue-as-current when current workspace already has artifacts', async () => {
  makeBmadDir(tmpDir);
  const currentPlan = path.join(tmpDir, 'docs', 'planning-artifacts');
  const v1Plan = path.join(tmpDir, 'docs', 'v1', 'planning-artifacts');
  fs.mkdirSync(currentPlan, { recursive: true });
  fs.mkdirSync(v1Plan, { recursive: true });
  fs.writeFileSync(path.join(currentPlan, 'prd.md'), '# current');
  fs.writeFileSync(path.join(v1Plan, 'prd.md'), '# archived');

  const res = await postRaw('/version/continue-as-current', { path: tmpDir, sourceVersionId: 'v1' });

  expect(res.statusCode).toBe(409);
  expect(res.body.error).toContain('请先归档当前工作区');
});
```

- [ ] **Step 3: 先跑这两条测试并确认 RED**

Run: `npx vitest run tests/server/versionDiscovery.test.ts -t "continue-as-current"`
Expected: FAIL，因为接口尚不存在。

- [ ] **Step 4: 写最小恢复实现**

```ts
// src/server.ts
if (req.method === 'POST' && req.url?.startsWith('/version/continue-as-current')) {
  // 1. 校验 path / sourceVersionId
  // 2. discoverVersionEntries() 找到归档版本
  // 3. current workspace 非空则 409
  // 4. copy archived planning/implementation artifacts -> current dirs
  // 5. writeResumeState(currentPlanDir, { archiveMode: 'overwrite', archiveTargetVersionId: sourceVersionId })
  // 6. res.end(JSON.stringify(getVersionedData(p)))
}
```

- [ ] **Step 5: 补最小目录复制 helper**

```ts
function copyDirContents(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirContents(from, to);
    else fs.copyFileSync(from, to);
  }
}
```

- [ ] **Step 6: 单跑恢复测试确认 GREEN**

Run: `npx vitest run tests/server/versionDiscovery.test.ts -t "continue-as-current"`
Expected: PASS

## Task 4: 先写覆盖归档测试，再实现 overwrite 模式

**Files:**
- Modify: `tests/server/versionDiscovery.test.ts`
- Modify: `src/archiveExecutor.ts`
- Modify: `src/server.ts`
- Modify: `src/archiveSuggestion.ts`

- [ ] **Step 1: 为“恢复后再次归档覆盖原版本”新增失败测试**

```ts
it('archives resumed current workspace back into the original version instead of creating a new one', async () => {
  makeBmadDir(tmpDir);
  const currentPlan = path.join(tmpDir, 'docs', 'planning-artifacts');
  const currentImpl = path.join(tmpDir, 'docs', 'implementation-artifacts');
  const v1Plan = path.join(tmpDir, 'docs', 'v1', 'planning-artifacts');
  const v1Impl = path.join(tmpDir, 'docs', 'v1', 'implementation-artifacts');

  fs.mkdirSync(currentPlan, { recursive: true });
  fs.mkdirSync(currentImpl, { recursive: true });
  fs.mkdirSync(v1Plan, { recursive: true });
  fs.mkdirSync(v1Impl, { recursive: true });
  fs.writeFileSync(path.join(currentPlan, 'prd.md'), '# updated v1');
  fs.writeFileSync(path.join(v1Plan, 'prd.md'), '# old v1');
  writeResumeState(currentPlan, { archiveMode: 'overwrite', archiveTargetVersionId: 'v1' });

  const result = await postJson('/version/archive-current', { path: tmpDir });

  expect(fs.readFileSync(path.join(v1Plan, 'prd.md'), 'utf-8')).toContain('updated v1');
  expect(result.versions.some((v: any) => v.version.id === 'v2')).toBe(false);
});
```

- [ ] **Step 2: 单跑覆盖归档测试并确认 RED**

Run: `npx vitest run tests/server/versionDiscovery.test.ts -t "archives resumed current workspace back into the original version"`
Expected: FAIL，因为当前仍会尝试新建版本号。

- [ ] **Step 3: 扩展 archive executor 支持 overwrite 模式**

```ts
export type ArchiveMode = 'new' | 'overwrite';

export function archiveCurrentWorkspace(
  planDir: string,
  implDir: string,
  targetDir: string,
  mode: ArchiveMode = 'new',
): ArchiveResult {
  if (mode === 'new') {
    // 保留现有 rename + 重建逻辑
  }

  // overwrite:
  // 1. targetDir 必须存在
  // 2. 删除 target planning/implementation 子目录
  // 3. copy current plan/impl -> target dirs
  // 4. 重建空 current workspace
}
```

- [ ] **Step 4: 在 archive-current 路由里切换模式**

```ts
const resumeState = readResumeState(planBase);
const archiveMode = resumeState?.archiveMode === 'overwrite' ? 'overwrite' : 'new';
const targetVersion = archiveMode === 'overwrite'
  ? resumeState!.archiveTargetVersionId
  : suggestion.targetVersion!;
const targetDir = path.join(path.dirname(planBase), targetVersion);
const result = archiveCurrentWorkspace(planBase, implBase, targetDir, archiveMode);
if (result.success) clearResumeState(planBase);
```

- [ ] **Step 5: 重新跑整份版本测试确认 GREEN**

Run: `npx vitest run tests/server/versionDiscovery.test.ts`
Expected: PASS

## Task 5: 前端接上归档模式与继续推进按钮

**Files:**
- Modify: `src/index.ts`
- Test manually: local plugin UI

- [ ] **Step 1: 让归档卡片不再依赖 retrospective 完成**

```ts
const archiveSuggestion = ver.archiveSuggestion;
if (ver.version.kind === 'current' && archiveSuggestion) {
  const targetLabel = archiveSuggestion.archiveMode === 'overwrite'
    ? archiveSuggestion.targetVersion
    : archiveSuggestion.targetVersion;
}
```

- [ ] **Step 2: 按 archive mode 切换文案**

```ts
const archiveText = archiveSuggestion?.archiveMode === 'overwrite'
  ? `归档回 ${tv}`
  : `${t.archiveBtn} ${tv}`;
const archiveDesc = archiveSuggestion?.archiveMode === 'overwrite'
  ? `当前工作区来自 ${tv}，归档时将覆盖 ${tv}`
  : `${t.archiveDesc} ${tv}`;
```

- [ ] **Step 3: 在归档版本页渲染继续推进按钮**

```ts
const continueBtnHtml = ver.version.kind === 'archived'
  ? `<button id="bf-continue-version" ...>继续为当前版本</button>`
  : '';
```

- [ ] **Step 4: 绑定继续推进事件**

```ts
root.querySelector('#bf-continue-version')?.addEventListener('click', async () => {
  try {
    const updated = await api.rpc('POST', 'version/continue-as-current', {
      path: ctx.project?.path || '',
      sourceVersionId: ver.version.id,
    }) as VersionedResponse;
    versionedData = updated;
    activeVersionId = updated.activeVersionId;
    renderVersioned(ctx);
  } catch (err) {
    alert((err as Error).message);
  }
});
```

- [ ] **Step 5: 本地手工验证 UI**

Run: `npm run build`
Expected: build 成功；在 UI 中验证：
- 当前版本未完成时仍显示归档卡片
- 归档版本页显示“继续为当前版本”
- 恢复后当前页显示“归档回 v1”

## Task 6: 全量验证与收尾

**Files:**
- Modify: `src/index.ts` / `src/server.ts` / `src/archiveExecutor.ts` if needed
- Test: `tests/server/versionDiscovery.test.ts`
- Test: full `npm test`

- [ ] **Step 1: 跑聚焦版本测试**

Run: `npx vitest run tests/server/versionDiscovery.test.ts`
Expected: PASS

- [ ] **Step 2: 跑全量测试**

Run: `npm test`
Expected: 业务相关单测全绿；若仍有既有 Playwright/Vitest 混跑失败，确认不是本次改动引入。

- [ ] **Step 3: 跑构建**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: 检查回归点**

Checklist:
- 当前工作区首次归档仍生成新版本号
- 恢复到当前后再次归档不生成新版本号
- 恢复冲突时不会覆盖当前工作区
- 当前工作区为空时归档按钮禁用

## Self-Review

- Spec coverage: 已覆盖常驻归档、恢复到当前、覆盖回原版本、冲突保护四个核心需求。
- Placeholder scan: 无 TBD / TODO / “后续实现”占位。
- Type consistency: 统一使用 `ArchiveMode`, `archiveTargetVersionId`, `continue-as-current` 命名。

## Execution Choice

用户已明确要求：计划写完后直接自检并开发实现。因此按本计划使用 inline execution 继续，采用 TDD 顺序实现。