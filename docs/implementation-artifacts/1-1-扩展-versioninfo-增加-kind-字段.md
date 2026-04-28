# Story 1-1: 扩展 VersionInfo 增加 kind 字段

## 描述
为 `VersionInfo` 增加 `kind` 字段，区分 current workspace 与 archived 版本。

## AC
1. `src/types.ts` 新增 `VersionKind = 'current' | 'archived'`
2. `VersionInfo` 增加 `kind: VersionKind` 字段
3. `src/server.ts` 中所有 `VersionInfo` 构造点补上 `kind`
4. TypeScript 编译通过
5. 现有测试全部通过

## 涉及文件
- `src/types.ts`
- `src/server.ts`

## 技术要点
- `discoverVersions()` 中 unversioned fallback → `kind: 'current'`
- `discoverVersions()` 中 vN 目录 → `kind: 'archived'`

## 测试验证
- `npx tsc --noEmit` 无错误
- `npx vitest run` 全绿
