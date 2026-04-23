import type { PluginAPI, PluginContext, FlowData, PhaseInfo, NextAction, SprintData, EpicEntry } from './types.js';

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

function renderPhases(phases: PhaseInfo[], c: TC): string {
  return `<div style="display:flex;gap:6px;margin-bottom:20px">
    ${phases.map((p, i) => {
      const color = (STATUS_COLORS[p.status] || STATUS_COLORS.pending)(c);
      const opacity = p.status === 'pending' ? '0.35' : '1';
      const glow = p.status === 'active' ? 'bf-glow' : '';
      return `
        <div class="bf-up ${glow}" style="flex:1;text-align:center;padding:10px 4px;background:${c.surface};border:1px solid ${p.status === 'active' ? color : c.border};border-radius:4px;opacity:${opacity};animation-delay:${i * 0.06}s">
          <div style="font-size:1.1rem">${p.status === 'done' ? '✓' : p.icon}</div>
          <div style="font-size:0.6rem;color:${color};margin-top:4px;letter-spacing:0.05em">${p.label}</div>
        </div>
        ${i < phases.length - 1 ? `<div style="display:flex;align-items:center;color:${c.muted};font-size:0.6rem">→</div>` : ''}`;
    }).join('')}
  </div>`;
}

function renderNextAction(na: NextAction, c: TC): string {
  return `
    <div class="bf-up bf-glow" style="background:${c.dim};border:1px solid ${c.accent};border-radius:4px;padding:16px;margin-bottom:20px;animation-delay:0.2s">
      <div style="font-size:0.6rem;color:${c.accent};letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">下一步</div>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:1.6rem;flex-shrink:0">${na.agentIcon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.78rem;font-weight:700;color:${c.text}">${na.command}</div>
          <div style="font-size:0.65rem;color:${c.muted};margin-top:3px;font-style:italic">${na.agent}: "${na.quote}"</div>
        </div>
        <button id="bf-copy" class="bf-copy-btn" style="flex-shrink:0;padding:5px 12px;background:transparent;border:1px solid ${c.border};color:${c.muted};font-family:${MONO};font-size:0.65rem;border-radius:3px;cursor:pointer;--bf-accent:${c.accent}">
          复制命令
        </button>
      </div>
    </div>`;
}

// ── Sprint renderer ───────────────────────────────────────────────────

const BADGE_COLORS: Record<string, string> = {
  'backlog': '#6b7280', 'ready-for-dev': '#3b82f6', 'in-progress': '#f59e0b', 'review': '#a78bfa', 'done': '#10b981',
};

function renderSprint(sprint: SprintData, c: TC): string {
  const pct = sprint.totalStories ? Math.round((sprint.doneStories / sprint.totalStories) * 100) : 0;
  const visibleEpics = sprint.epics.slice(0, 10);
  return `
    <div class="bf-up" style="background:${c.surface};border:1px solid ${c.border};border-radius:4px;padding:16px;animation-delay:0.3s">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:0.6rem;color:${c.muted};letter-spacing:0.1em;text-transform:uppercase">Sprint 进度</div>
        <div style="font-size:0.65rem;color:${c.accent}">${sprint.doneStories}/${sprint.totalStories} (${pct}%)</div>
      </div>
      <div style="height:4px;background:${c.border};border-radius:2px;overflow:hidden;margin-bottom:14px">
        <div style="height:100%;width:${pct}%;background:${c.green};border-radius:2px;transition:width 0.6s"></div>
      </div>
      ${visibleEpics.map(epic => renderEpic(epic, c)).join('')}
    </div>`;
}

function renderEpic(epic: EpicEntry, c: TC): string {
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
          <span style="color:${BADGE_COLORS[s.status] || c.muted};flex-shrink:0">${s.status}</span>
        </div>`).join('')}
    </div>`;
}

// ── Empty state ───────────────────────────────────────────────────────

function renderEmpty(c: TC): string {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60%;gap:16px;text-align:center">
      <div style="font-size:2rem;opacity:0.3">🚀</div>
      <div style="font-size:0.78rem;color:${c.text}">未检测到 Bmad 项目</div>
      <div style="font-size:0.65rem;color:${c.muted};max-width:320px">运行以下命令初始化 Bmad 方法论：</div>
      <code style="font-size:0.72rem;color:${c.accent};background:${c.dim};padding:8px 16px;border-radius:4px;font-family:${MONO}">npx bmad-method install</code>
    </div>`;
}

// ── HTML escape ───────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Mount / Unmount ───────────────────────────────────────────────────

export function mount(container: HTMLElement, api: PluginAPI): void {
  ensureAssets();
  let cachedPath = '';

  const root = document.createElement('div');
  Object.assign(root.style, { height: '100%', overflowY: 'auto', boxSizing: 'border-box', padding: '24px', fontFamily: MONO });
  container.appendChild(root);

  function render(ctx: PluginContext, data: FlowData | null): void {
    const c = tc(ctx.theme === 'dark');
    root.style.background = c.bg;
    root.style.color = c.text;

    if (!ctx.project) {
      root.textContent = '';
      const d = document.createElement('div');
      Object.assign(d.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', gap: '14px' });
      const t = document.createElement('div');
      Object.assign(t.style, { fontSize: '0.72rem', color: c.muted, letterSpacing: '0.1em', textTransform: 'uppercase' });
      t.textContent = 'select a project';
      d.appendChild(t);
      root.appendChild(d);
      return;
    }

    const name = esc(ctx.project.name);
    const projPath = esc(ctx.project.path);

    if (!data) {
      root.innerHTML = `<div style="margin-bottom:24px"><div style="font-size:1.1rem;font-weight:700">${name}<span style="color:${c.accent}">▌</span></div><div style="font-size:0.65rem;color:${c.muted};margin-top:4px">${projPath}</div></div><div style="padding:20px">${[80, 60, 40].map((w, i) => `<div class="bf-skel" style="height:10px;width:${w}%;background:${c.muted};border-radius:2px;margin-bottom:10px;animation-delay:${i * 0.1}s"></div>`).join('')}</div>`;
      return;
    }

    if (!data.bmadDetected) { root.innerHTML = renderEmpty(c); return; }

    root.innerHTML = `<div class="bf-up" style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px"><div style="min-width:0;flex:1"><div style="font-size:1.1rem;font-weight:700;word-break:break-all">${name}<span style="color:${c.accent}">▌</span></div><div style="font-size:0.65rem;color:${c.muted};margin-top:4px;word-break:break-all">${projPath}</div></div><button id="bf-refresh" style="flex-shrink:0;margin-left:16px;padding:5px 12px;background:transparent;border:1px solid ${c.border};color:${c.muted};font-family:${MONO};font-size:0.65rem;border-radius:3px;cursor:pointer">↻ 刷新</button></div>${renderPhases(data.phases, c)}${data.nextAction ? renderNextAction(data.nextAction, c) : ''}${data.sprint ? renderSprint(data.sprint, c) : ''}`;

    root.querySelector('#bf-refresh')?.addEventListener('click', () => load(api.context));
    const copyBtn = root.querySelector('#bf-copy') as HTMLButtonElement | null;
    if (copyBtn && data.nextAction) {
      const cmd = data.nextAction.command;
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(cmd).then(() => {
          copyBtn.textContent = '✓ 已复制';
          setTimeout(() => { copyBtn.textContent = '复制命令'; }, 1500);
        });
      });
    }
  }

  async function load(ctx: PluginContext): Promise<void> {
    if (!ctx.project) { render(ctx, null); return; }
    render(ctx, null);
    try {
      const data = (await api.rpc('GET', `flow?path=${encodeURIComponent(ctx.project.path)}`)) as FlowData;
      cachedPath = ctx.project.path;
      render(ctx, data);
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
    else load(ctx);
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
