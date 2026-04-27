import type { PluginAPI, PluginContext, FlowData, PhaseInfo, NextAction, SprintData, EpicEntry, Locale, MethodologyResponse, VersionedResponse, VersionFlowData, SprintEntry } from './types.js';
import { renderMethodology, renderMethodologySkeleton, bindMethodologyEvents } from './methodologyRender.js';
import { bindMethodologyInteractions } from './methodologyState.js';

// ── i18n ──────────────────────────────────────────────────────────────

interface I18nStrings {
  phases: Record<string, string>;
  statuses: Record<string, string>;
  nextStep: string;
  copyCmd: string;
  copied: string;
  sprintProgress: string;
  refresh: string;
  selectProject: string;
  noBmadProject: string;
  noBmadHint: string;
  version: string;
  sprint: string;
}

const I18N: Record<Locale, I18nStrings> = {
  'zh-CN': {
    phases: { discovery: '发现', planning: '规划', design: '设计', development: '开发', retrospective: '复盘' },
    statuses: { backlog: '待办', 'ready-for-dev': '待开发', 'in-progress': '进行中', review: '评审', done: '完成' },
    nextStep: '下一步',
    copyCmd: '复制命令',
    copied: '✓ 已复制',
    sprintProgress: 'Sprint 进度',
    refresh: '↻ 刷新',
    selectProject: '请选择项目',
    noBmadProject: '未检测到 Bmad 项目',
    noBmadHint: '运行以下命令初始化 Bmad 方法论：',
    version: '版本',
    sprint: 'Sprint',
  },
  en: {
    phases: { discovery: 'Discovery', planning: 'Planning', design: 'Design', development: 'Development', retrospective: 'Retrospective' },
    statuses: { backlog: 'backlog', 'ready-for-dev': 'ready-for-dev', 'in-progress': 'in-progress', review: 'review', done: 'done' },
    nextStep: 'Next Step',
    copyCmd: 'Copy',
    copied: '✓ Copied',
    sprintProgress: 'Sprint Progress',
    refresh: '↻ Refresh',
    selectProject: 'select a project',
    noBmadProject: 'No Bmad project detected',
    noBmadHint: 'Run the following command to initialize Bmad methodology:',
    version: 'Version',
    sprint: 'Sprint',
  },
};

function getI18n(locale?: Locale): I18nStrings {
  return I18N[locale ?? 'zh-CN'] ?? I18N['zh-CN'];
}

// ── Theme ─────────────────────────────────────────────────────────────

interface TC { bg: string; surface: string; border: string; text: string; muted: string; accent: string; dim: string; green: string; yellow: string; red: string; }

function tc(dark: boolean): TC {
  return dark
    ? { bg: '#08080f', surface: '#0e0e1a', border: '#1a1a2c', text: '#e2e0f0', muted: '#52507a', accent: '#fbbf24', dim: 'rgba(251,191,36,0.1)', green: '#10b981', yellow: '#f59e0b', red: '#f43f5e' }
    : { bg: '#fafaf9', surface: '#ffffff', border: '#e8e6f0', text: '#0f0e1a', muted: '#9490b0', accent: '#d97706', dim: 'rgba(217,119,6,0.08)', green: '#059669', yellow: '#d97706', red: '#dc2626' };
}

const MONO = "'JetBrains Mono','Fira Code',ui-monospace,monospace";

// ── Assets ────────────────────────────────────────────────────────────

function ensureAssets(): void {
  if (document.getElementById('bf-font')) return;
  const link = document.createElement('link');
  link.id = 'bf-font'; link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap';
  document.head.appendChild(link);
  const s = document.createElement('style');
  s.id = 'bf-styles';
  s.textContent = `
    @keyframes bf-fadeup { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
    @keyframes bf-pulse  { 0%,100% { opacity:.25 } 50% { opacity:.55 } }
    @keyframes bf-glow   { 0%,100% { box-shadow:0 0 4px rgba(251,191,36,0.2) } 50% { box-shadow:0 0 12px rgba(251,191,36,0.4) } }
    .bf-up   { animation: bf-fadeup 0.4s ease both }
    .bf-skel { animation: bf-pulse 1.6s ease infinite }
    .bf-glow { animation: bf-glow 2s ease infinite }
    .bf-copy-btn { transition: all 0.15s }
    .bf-copy-btn:hover { border-color: var(--bf-accent) !important; color: var(--bf-accent) !important }
  `;
  document.head.appendChild(s);
}

// ── Renderers ─────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, (c: TC) => string> = {
  done: c => c.green, active: c => c.yellow, pending: c => c.muted,
};

function renderPhases(phases: PhaseInfo[], c: TC, t: I18nStrings): string {
  return `<div style="display:flex;gap:6px;margin-bottom:20px">
    ${phases.map((p, i) => {
      const color = (STATUS_COLORS[p.status] || STATUS_COLORS.pending)(c);
      const opacity = p.status === 'pending' ? '0.35' : '1';
      const glow = p.status === 'active' ? 'bf-glow' : '';
      const label = t.phases[p.phase] || p.label;
      return `
        <div class="bf-up ${glow}" style="flex:1;text-align:center;padding:10px 4px;background:${c.surface};border:1px solid ${p.status === 'active' ? color : c.border};border-radius:4px;opacity:${opacity};animation-delay:${i * 0.06}s">
          <div style="font-size:1.1rem">${p.status === 'done' ? '✓' : p.icon}</div>
          <div style="font-size:0.6rem;color:${color};margin-top:4px;letter-spacing:0.05em">${label}</div>
        </div>
        ${i < phases.length - 1 ? `<div style="display:flex;align-items:center;color:${c.muted};font-size:0.6rem">→</div>` : ''}`;
    }).join('')}
  </div>`;
}

function renderNextAction(na: NextAction, c: TC, t: I18nStrings): string {
  return `
    <div class="bf-up bf-glow" style="background:${c.dim};border:1px solid ${c.accent};border-radius:4px;padding:16px;margin-bottom:20px;animation-delay:0.2s">
      <div style="font-size:0.6rem;color:${c.accent};letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">${t.nextStep}</div>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:1.6rem;flex-shrink:0">${na.agentIcon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.78rem;font-weight:700;color:${c.text}">${na.command}</div>
          <div style="font-size:0.65rem;color:${c.muted};margin-top:3px;font-style:italic">${na.agent}: "${na.quote}"</div>
        </div>
        <button id="bf-copy" class="bf-copy-btn" style="flex-shrink:0;padding:5px 12px;background:transparent;border:1px solid ${c.border};color:${c.muted};font-family:${MONO};font-size:0.65rem;border-radius:3px;cursor:pointer;--bf-accent:${c.accent}">
          ${t.copyCmd}
        </button>
      </div>
    </div>`;
}

// ── Version tabs renderer ────────────────────────────────────────────

function renderVersionTabs(versions: VersionFlowData[], activeId: string, c: TC): string {
  if (versions.length <= 1 && versions[0]?.version.id === '__unversioned__') return '';
  return `<div class="bf-version-tabs" style="display:flex;gap:2px;margin-bottom:16px;border-bottom:1px solid ${c.border};padding-bottom:0">
    ${versions.map(v => {
      const active = v.version.id === activeId;
      const color = v.phases.every(p => p.status === 'done') ? c.green
        : v.phases.some(p => p.status === 'active') ? c.yellow : c.muted;
      return `<button class="bf-version-tab" data-version="${v.version.id}"
        style="padding:6px 14px;font-family:${MONO};font-size:0.65rem;
        background:transparent;border:none;border-bottom:2px solid ${active ? c.accent : 'transparent'};
        color:${active ? c.text : c.muted};cursor:pointer">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${color};margin-right:6px"></span>
        ${v.version.label}
      </button>`;
    }).join('')}
  </div>`;
}

// ── Sprint selector renderer ─────────────────────────────────────────

function renderSprintSelector(sprints: SprintEntry[], activeSprint: number, c: TC): string {
  if (sprints.length <= 1) return '';
  return `<div class="bf-sprint-selector" style="display:flex;gap:4px;margin-bottom:8px">
    ${sprints.map(s => {
      const active = s.sprintNumber === activeSprint;
      return `<button class="bf-sprint-pill" data-sprint="${s.sprintNumber}"
        style="padding:3px 10px;font-family:${MONO};font-size:0.6rem;
        background:${active ? c.dim : 'transparent'};border:1px solid ${active ? c.accent : c.border};
        color:${active ? c.accent : c.muted};border-radius:12px;cursor:pointer">
        S${s.sprintNumber}
      </button>`;
    }).join('')}
  </div>`;
}

// ── Sprint renderer ───────────────────────────────────────────────────

const BADGE_COLORS: Record<string, string> = {
  'backlog': '#6b7280', 'ready-for-dev': '#3b82f6', 'in-progress': '#f59e0b', 'review': '#a78bfa', 'done': '#10b981',
};

function renderSprint(sprint: SprintData, c: TC, t: I18nStrings): string {
  const pct = sprint.totalStories ? Math.round((sprint.doneStories / sprint.totalStories) * 100) : 0;
  const visibleEpics = sprint.epics.slice(0, 10);
  return `
    <div class="bf-up" style="background:${c.surface};border:1px solid ${c.border};border-radius:4px;padding:16px;animation-delay:0.3s">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:0.6rem;color:${c.muted};letter-spacing:0.1em;text-transform:uppercase">${t.sprintProgress}</div>
        <div style="font-size:0.65rem;color:${c.accent}">${sprint.doneStories}/${sprint.totalStories} (${pct}%)</div>
      </div>
      <div style="height:4px;background:${c.border};border-radius:2px;overflow:hidden;margin-bottom:14px">
        <div style="height:100%;width:${pct}%;background:${c.green};border-radius:2px;transition:width 0.6s"></div>
      </div>
      ${visibleEpics.map(epic => renderEpic(epic, c, t)).join('')}
    </div>`;
}

function renderEpic(epic: EpicEntry, c: TC, t: I18nStrings): string {
  const done = epic.stories.filter(s => s.status === 'done').length;
  const total = epic.stories.length;
  const stories = epic.stories.slice(0, 10);
  return `
    <div style="margin-bottom:10px">
      <div style="font-size:0.68rem;font-weight:600;color:${c.text};margin-bottom:4px">
        ${epic.key} <span style="color:${c.muted};font-weight:400">${done}/${total}</span>
      </div>
      ${stories.map(s => `
        <div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:0.62rem">
          <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${BADGE_COLORS[s.status] || c.muted};flex-shrink:0"></span>
          <span style="color:${c.text};opacity:0.8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${s.key}</span>
          <span style="color:${BADGE_COLORS[s.status] || c.muted};flex-shrink:0">${t.statuses[s.status] || s.status}</span>
        </div>`).join('')}
    </div>`;
}

// ── Empty state ───────────────────────────────────────────────────────

const INIT_CMD = `npx bmad-method install \\
  --directory . \\
  --modules bmm,cis,tea,bmb \\
  --tools claude-code,cursor,codex,gemini \\
  --user-name "Engineer" \\
  --communication-language Chinese \\
  --document-output-language Chinese \\
  --output-folder docs \\
  --yes`;

function renderEmpty(c: TC, t: I18nStrings): string {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60%;gap:16px;text-align:center">
      <div style="font-size:2rem;opacity:0.3">🚀</div>
      <div style="font-size:0.78rem;color:${c.text}">${t.noBmadProject}</div>
      <div style="font-size:0.65rem;color:${c.muted};max-width:320px">${t.noBmadHint}</div>
      <div style="position:relative;max-width:420px;width:100%">
        <pre id="bf-init-cmd" style="font-size:0.62rem;color:${c.accent};background:${c.dim};padding:12px 16px;border-radius:4px;font-family:${MONO};text-align:left;white-space:pre-wrap;word-break:break-all;margin:0;cursor:pointer;border:1px solid ${c.border}">${esc(INIT_CMD)}</pre>
        <button id="bf-init-copy" class="bf-copy-btn" style="position:absolute;top:6px;right:6px;padding:3px 8px;background:${c.surface};border:1px solid ${c.border};color:${c.muted};font-family:${MONO};font-size:0.58rem;border-radius:3px;cursor:pointer;--bf-accent:${c.accent}">${t.copyCmd}</button>
      </div>
    </div>`;
}

// ── Clipboard helper ─────────────────────────────────────────────────

function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  }
  return fallbackCopy(text);
}

function fallbackCopy(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy') ? resolve() : reject(new Error('copy failed'));
    } catch (e) {
      reject(e);
    } finally {
      document.body.removeChild(ta);
    }
  });
}

// ── HTML escape ───────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Mount / Unmount ───────────────────────────────────────────────────

export function mount(container: HTMLElement, api: PluginAPI): void {
  ensureAssets();
  let cachedPath = '';
  let methodologyData: MethodologyResponse | null = null;
  let versionedData: VersionedResponse | null = null;
  let activeVersionId = '';
  let activeSprintNum = 0;

  const root = document.createElement('div');
  Object.assign(root.style, { height: '100%', overflowY: 'auto', boxSizing: 'border-box', padding: '24px', fontFamily: MONO });
  container.appendChild(root);

  function getActiveVersion(): VersionFlowData | null {
    if (!versionedData) return null;
    return versionedData.versions.find(v => v.version.id === activeVersionId) ?? versionedData.versions[0] ?? null;
  }

  function renderVersioned(ctx: PluginContext): void {
    const c = tc(ctx.theme === 'dark');
    const t = getI18n(ctx.locale);
    root.style.background = c.bg;
    root.style.color = c.text;

    if (!ctx.project) {
      root.textContent = '';
      const d = document.createElement('div');
      Object.assign(d.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', gap: '14px' });
      const txt = document.createElement('div');
      Object.assign(txt.style, { fontSize: '0.72rem', color: c.muted, letterSpacing: '0.1em', textTransform: 'uppercase' });
      txt.textContent = t.selectProject;
      d.appendChild(txt);
      root.appendChild(d);
      return;
    }

    const name = esc(ctx.project.name);
    const projPath = esc(ctx.project.path);

    if (!versionedData) {
      root.innerHTML = `<div style="margin-bottom:24px"><div style="font-size:1.1rem;font-weight:700">${name}<span style="color:${c.accent}">&#x258C;</span></div><div style="font-size:0.65rem;color:${c.muted};margin-top:4px">${projPath}</div></div><div style="padding:20px">${[80, 60, 40].map((w, i) => `<div class="bf-skel" style="height:10px;width:${w}%;background:${c.muted};border-radius:2px;margin-bottom:10px;animation-delay:${i * 0.1}s"></div>`).join('')}</div>`;
      return;
    }

    const ver = getActiveVersion();
    if (!ver || !ver.bmadDetected) {
      root.innerHTML = renderEmpty(c, t);
      const initCopyBtn = root.querySelector('#bf-init-copy') as HTMLButtonElement | null;
      const initCmd = root.querySelector('#bf-init-cmd') as HTMLElement | null;
      const doCopy = () => {
        copyToClipboard(INIT_CMD).then(() => {
          if (initCopyBtn) { initCopyBtn.textContent = t.copied; setTimeout(() => { initCopyBtn.textContent = t.copyCmd; }, 1500); }
        });
      };
      initCopyBtn?.addEventListener('click', doCopy);
      initCmd?.addEventListener('click', doCopy);
      return;
    }

    const sprintToShow = ver.sprints.find(s => s.sprintNumber === activeSprintNum)?.data ?? ver.sprint;
    const vTabsHtml = renderVersionTabs(versionedData.versions, activeVersionId, c);
    const sSelectorHtml = ver.sprints.length > 1 ? renderSprintSelector(ver.sprints, activeSprintNum, c) : '';

    root.innerHTML = [
      `<div class="bf-up" style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px"><div style="min-width:0;flex:1"><div style="font-size:1.1rem;font-weight:700;word-break:break-all">${name}<span style="color:${c.accent}">&#x258C;</span></div><div style="font-size:0.65rem;color:${c.muted};margin-top:4px;word-break:break-all">${projPath}</div></div><button id="bf-refresh" style="flex-shrink:0;margin-left:16px;padding:5px 12px;background:transparent;border:1px solid ${c.border};color:${c.muted};font-family:${MONO};font-size:0.65rem;border-radius:3px;cursor:pointer">${t.refresh}</button></div>`,
      vTabsHtml,
      renderPhases(ver.phases, c, t),
      ver.nextAction ? renderNextAction(ver.nextAction, c, t) : '',
      sSelectorHtml,
      sprintToShow ? renderSprint(sprintToShow, c, t) : '',
      methodologyData ? renderMethodology(methodologyData, c, MONO) : '',
    ].join('');

    root.querySelector('#bf-refresh')?.addEventListener('click', () => load(api.context));
    root.querySelectorAll('.bf-version-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeVersionId = (btn as HTMLElement).dataset.version || '';
        const nv = getActiveVersion();
        activeSprintNum = nv?.activeSprint ?? 0;
        renderVersioned(ctx);
      });
    });
    root.querySelectorAll('.bf-sprint-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        activeSprintNum = parseInt((btn as HTMLElement).dataset.sprint || '0');
        renderVersioned(ctx);
      });
    });
    bindMethodologyEvents(root);
    if (methodologyData) { bindMethodologyInteractions(root, c, copyToClipboard); }
    const copyBtn = root.querySelector('#bf-copy') as HTMLButtonElement | null;
    if (copyBtn && ver.nextAction) {
      const cmd = ver.nextAction.command;
      copyBtn.addEventListener('click', () => {
        copyToClipboard(cmd).then(() => { copyBtn.textContent = t.copied; setTimeout(() => { copyBtn.textContent = t.copyCmd; }, 1500); });
      });
    }
  }

  async function load(ctx: PluginContext): Promise<void> {
    if (!ctx.project) { versionedData = null; renderVersioned(ctx); return; }
    versionedData = null;
    renderVersioned(ctx);
    try {
      const enc = encodeURIComponent(ctx.project.path);
      const [verData, methData] = await Promise.all([
        api.rpc('GET', `versions?path=${enc}`).then(d => d as VersionedResponse).catch(() => null),
        api.rpc('GET', `methodology?path=${enc}`).then(d => d as MethodologyResponse).catch(() => null),
      ]);
      if (verData) {
        versionedData = verData;
        activeVersionId = verData.activeVersionId;
        const av = getActiveVersion();
        activeSprintNum = av?.activeSprint ?? 0;
        methodologyData = av?.bmadDetected ? methData : null;
      } else {
        const flowData = await api.rpc('GET', `flow?path=${enc}`) as FlowData;
        versionedData = {
          versions: [{ ...flowData, version: { id: '__unversioned__', label: '', planningDir: '', implementationDir: '' }, sprints: [], activeSprint: 0 }],
          activeVersionId: '__unversioned__', unversioned: true,
        };
        activeVersionId = '__unversioned__';
        activeSprintNum = 0;
        methodologyData = flowData.bmadDetected ? methData : null;
      }
      cachedPath = ctx.project.path;
      renderVersioned(ctx);
    } catch (err) {
      const c = tc(ctx.theme === 'dark');
      const d = document.createElement('div');
      Object.assign(d.style, { padding: '24px', fontSize: '0.78rem', color: c.red, fontFamily: MONO });
      d.textContent = '✗ ' + (err as Error).message;
      root.textContent = '';
      root.appendChild(d);
    }
  }

  load(api.context);
  const unsub = api.onContextChange(ctx => {
    if (ctx.project?.path !== cachedPath) load(ctx);
    else renderVersioned(ctx);
  });
  (container as any)._bfUnsub = unsub;
}

export function unmount(container: HTMLElement): void {
  if (typeof (container as any)._bfUnsub === 'function') {
    (container as any)._bfUnsub();
    delete (container as any)._bfUnsub;
  }
  container.innerHTML = '';
}
