# Next Action Anchor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 BMad Flow 的“下一步”推荐基于用户最后推进到的阶段，而不是回退到最早缺失的前置产物。

**Architecture:** 保留现有 `RULES` 数据结构，在 `src/server.ts` 中新增一个独立的 progress anchor 计算函数，用“最晚被证据证明已到达的阶段”过滤低阶段推荐规则。这样可以最小改动修复推荐逻辑，同时不改动路由结构和前端渲染契约。

**Tech Stack:** TypeScript, Node HTTP server, Vitest, tsx

---

## File Map

- Modify: `src/server.ts`
  - 新增 phase 顺序常量与 `computeProgressAnchor()`
  - 调整 `computeNextAction()`，让它先算 anchor，再过滤早于 anchor 的规则
- Modify: `tests/server/flowStatus.test.ts`
  - 新增回归测试，覆盖“后期已推进但前期产物缺失”时的 nextAction 选择
- Read during implementation: `src/types.ts`
  - 复用 `Phase`、`FlowData`、`NextAction` 等既有类型，不新增共享类型文件

### Task 1: 写回归测试锁定当前 bug

**Files:**
- Modify: `tests/server/flowStatus.test.ts`
- Test: `tests/server/flowStatus.test.ts`

- [ ] **Step 1: 在测试文件里新增一个可复用的 sprint YAML 构造函数**

```ts
function makeSprintYaml(options?: {
  storyStatus?: 'ready-for-dev' | 'review' | 'done';
  retroStatus?: 'optional' | 'done';
}): string {
  const storyStatus = options?.storyStatus ?? 'done';
  const retroStatus = options?.retroStatus ?? 'done';

  return [
    'project: test',
    'development_status:',
    '  epic-1: done',
    `  1-1-story: ${storyStatus}`,
    `  epic-1-retrospective: ${retroStatus}`,
  ].join('\n');
}
```

- [ ] **Step 2: 让现有全完成测试继续复用默认的 completed sprint**

```ts
function makeCompletedSprintYaml(): string {
  return makeSprintYaml();
}
```

- [ ] **Step 3: 新增“已完成 retrospective 但缺少早期产物时不回退”的失败测试**

```ts
it('does not fall back to discovery actions after retrospective is complete', async () => {
  fs.rmSync(path.join(tmpDir, 'docs', 'planning-artifacts', 'prd.md'));

  const data = await requestJson(`/flow?path=${encodeURIComponent(tmpDir)}`);

  expect(data.nextAction).toBeNull();
});
```

- [ ] **Step 4: 新增“开发阶段已开始时优先返回开发动作”的失败测试**

```ts
it('prefers development actions once sprint work has started even when early docs are missing', async () => {
  fs.rmSync(path.join(tmpDir, 'docs', 'planning-artifacts', 'prd.md'));
  fs.writeFileSync(
    path.join(tmpDir, 'docs', 'implementation-artifacts', 'sprint-status.yaml'),
    makeSprintYaml({ storyStatus: 'ready-for-dev', retroStatus: 'optional' }),
  );

  const data = await requestJson(`/flow?path=${encodeURIComponent(tmpDir)}`);

  expect(data.nextAction?.command).toBe('/bmad-dev-story');
});
```

- [ ] **Step 5: 新增“没有后期证据时仍保持 discovery 默认行为”的保护测试**

```ts
it('keeps discovery recommendation when no later-stage evidence exists', async () => {
  fs.rmSync(path.join(tmpDir, 'docs', 'planning-artifacts', 'prd.md'));
  fs.rmSync(path.join(tmpDir, 'docs', 'planning-artifacts', 'epics.md'));
  fs.rmSync(path.join(tmpDir, 'docs', 'planning-artifacts', 'architecture.md'));
  fs.rmSync(path.join(tmpDir, 'docs', 'implementation-artifacts', 'sprint-status.yaml'));

  const data = await requestJson(`/flow?path=${encodeURIComponent(tmpDir)}`);

  expect(data.nextAction?.command).toBe('/bmad-product-brief');
});
```

- [ ] **Step 6: 先单测运行一次，确认新增用例先失败**

Run:

```bash
npm run test -- tests/server/flowStatus.test.ts
```

Expected:
- 新增“development actions once sprint work has started”测试失败，当前实现会错误返回 `/bmad-create-prd`
- 其余老测试继续通过，或者同样暴露 nextAction 回退问题

### Task 2: 在后端加入 progress anchor 并过滤低阶段规则

**Files:**
- Modify: `src/server.ts:129-179`
- Test: `tests/server/flowStatus.test.ts`

- [ ] **Step 1: 在 `src/server.ts` 中新增 phase 顺序常量和 phase 排名函数**

```ts
const PHASE_ORDER: Phase[] = ['discovery', 'planning', 'design', 'development', 'retrospective'];

function getPhaseRank(phase: Phase): number {
  return PHASE_ORDER.indexOf(phase);
}
```

- [ ] **Step 2: 新增一个只负责推断“最后推进到哪个阶段”的函数**

```ts
function computeProgressAnchor(a: ArtifactMap, sprint: SprintData | null): Phase | null {
  const allStoriesDone = sprint ? sprint.epics.every(e => e.status === 'done') : false;
  const allRetrosDone = sprint ? sprint.epics.length > 0 && sprint.epics.every(e => e.retroStatus === 'done') : false;
  const hasSprintEvidence = !!a.sprintStatus && !!sprint && sprint.epics.length > 0;

  if (allRetrosDone) return 'retrospective';
  if (allStoriesDone) return 'retrospective';
  if (hasSprintEvidence) return 'development';
  if (a.architecture || a.uxDesign) return 'design';
  if (a.epics || a.prd) return 'planning';
  if (a.productBrief) return 'discovery';
  return null;
}
```

- [ ] **Step 3: 调整 `computeNextAction()`，先算 anchor，再跳过更早阶段的规则**

```ts
function computeNextAction(a: ArtifactMap, sprint: SprintData | null): NextAction | null {
  const anchor = computeProgressAnchor(a, sprint);
  const minRank = anchor ? getPhaseRank(anchor) : -1;

  for (const rule of RULES) {
    if (getPhaseRank(rule.action.phase) < minRank) continue;
    if (rule.condition(a, sprint)) return rule.action;
  }

  return null;
}
```

- [ ] **Step 4: 保持 `RULES` 原样，不额外重构数据结构**

```ts
const RULES: Rule[] = [
  // 保持原有 discovery / planning / design / development / retrospective 顺序
];
```

说明：这一步不改 `Rule` 接口，不拆文件，不改 API 响应格式，确保改动只聚焦在 nextAction 判定。

- [ ] **Step 5: 跑刚才的单测，确认新旧场景都通过**

Run:

```bash
npm run test -- tests/server/flowStatus.test.ts
```

Expected:
- 所有 `flowStatus` 测试通过
- 完成 retrospective 的场景返回 `nextAction = null`
- 开发已开始且缺少早期文档的场景返回 `/bmad-dev-story`

### Task 3: 做一次小范围回归验证

**Files:**
- Modify: none
- Test: `tests/server/flowStatus.test.ts`

- [ ] **Step 1: 运行 nextAction 相关测试，确认没有误伤已有行为**

Run:

```bash
npm run test -- tests/server/flowStatus.test.ts tests/server/versionDiscovery.test.ts
```

Expected:
- 两个测试文件全部通过
- 不出现因为 `computeNextAction()` 改动导致的版本发现回归

- [ ] **Step 2: 运行完整测试套件做一次最终校验**

Run:

```bash
npm run test
```

Expected:
- Vitest 全量通过
- 没有新的 snapshot 或接口契约回归

- [ ] **Step 3: 记录本次实现范围，避免顺手改 phase 条渲染逻辑**

```md
This change only updates nextAction selection.
Phase badge normalization stays unchanged in this patch.
```

说明：当前任务只修复“下一步”回退问题，不顺带改 `computePhases()`，避免把一个推荐逻辑修复扩大成整套阶段状态重构。
