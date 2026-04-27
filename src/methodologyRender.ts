import type { MethodologyResponse, MethodologySection } from './types.js';

interface TC { bg: string; surface: string; border: string; text: string; muted: string; accent: string; dim: string; green: string; yellow: string; red: string; }

const PHASE_ICONS: Record<string, string> = {
  '1-discovery': '🔍',
  '2-planning': '📋',
  '3-solution-design': '🏗️',
  '4-implementation': '💻',
  '1-analysis': '🔍',
  '3-solutioning': '🏗️',
};

export function renderMethodologySkeleton(c: TC, mono: string): string {
  return `<div class="bf-methodology" style="background:${c.surface};border:1px solid ${c.border};border-radius:4px;padding:16px;margin-top:16px;font-family:${mono}">
    <div style="font-size:0.6rem;color:${c.muted};letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px">方法论导航</div>
    ${[70, 55, 40, 60].map((w, i) => `<div class="bf-skel" style="height:8px;width:${w}%;background:${c.muted};border-radius:2px;margin-bottom:8px;animation-delay:${i * 0.1}s"></div>`).join('')}
  </div>`;
}

export function renderMethodology(data: MethodologyResponse, c: TC, mono: string, container?: HTMLElement): string {
  if (!data.sections || data.sections.length === 0) return '';

  const compact = typeof window !== 'undefined' && (container?.offsetWidth ?? 500) < 400;
  const itemPad = compact ? 'padding:3px 0;font-size:0.58rem;' : 'padding:4px 0;font-size:0.62rem;';

  const sectionsHtml = data.sections.map(section => renderSection(section, c, itemPad)).join('');

  return `<div class="bf-up bf-methodology" style="background:${c.surface};border:1px solid ${c.border};border-radius:4px;padding:16px;margin-top:16px;font-family:${mono}">
    <div style="font-size:0.6rem;color:${c.muted};letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px">方法论导航</div>
    ${sectionsHtml}
  </div>`;
}

function renderSection(section: MethodologySection, c: TC, itemPad: string): string {
  const sectionLabel = `<div style="font-size:0.55rem;color:${c.muted};letter-spacing:0.08em;text-transform:uppercase;margin:12px 0 6px;display:flex;align-items:center;gap:6px">
    <span>${section.icon}</span>${esc(section.displayName)}
  </div>`;

  let content = '';
  if (section.kind === 'phase-workflows' && section.groups) {
    content = section.groups.map(g => renderCollapsibleGroup(g.displayName, PHASE_ICONS[g.phase] ?? '📂', g.items, c, itemPad, false)).join('');
  } else if (section.kind === 'agents' && section.agents) {
    content = section.agents.map(ag => renderCollapsibleGroup(ag.displayName, '🤖', ag.items, c, itemPad, true)).join('');
  } else if (section.kind === 'general' && section.groups) {
    content = section.groups.map(g => renderCollapsibleGroup(g.displayName, g.phase === 'core' ? '🧩' : '🔧', g.items, c, itemPad, false)).join('');
  }

  return `<div class="bf-method-section" style="margin-bottom:4px">${sectionLabel}${content}</div>`;
}

function renderCollapsibleGroup(name: string, icon: string, items: import('./types.js').MethodologyItem[], c: TC, _itemPad: string, expanded: boolean): string {
  const count = items.length;
  const collapsed = expanded ? '' : 'bf-collapsed';
  const chevron = `<span class="bf-chevron" style="font-size:0.5rem;margin-right:6px;transition:transform 0.2s;display:inline-block${expanded ? ';transform:rotate(90deg)' : ''}">▶</span>`;

  const itemsHtml = items.map(item => {
    const reqBar = item.required ? `border-left:2px solid ${c.accent};` : '';
    const desc = item.description.length > 80 ? item.description.slice(0, 80) + '...' : item.description;
    const codeTag = item.menuCode ? `<span style="color:${c.muted};font-size:0.5rem;margin-left:6px">[${esc(item.menuCode)}]</span>` : '';
    return `<div class="bf-method-card" data-skill="${esc(item.skill)}" style="padding:6px 8px;margin:3px 0;border:1px solid ${c.border};border-radius:3px;cursor:pointer;${reqBar}transition:background 0.15s">
      <div style="font-size:0.62rem;font-weight:600;color:${c.text}">${esc(item.displayName)}${codeTag}</div>
      ${desc ? `<div style="font-size:0.52rem;color:${c.muted};margin-top:2px;line-height:1.3">${esc(desc)}</div>` : ''}
    </div>`;
  }).join('');

  return `<div class="bf-method-group" style="margin-bottom:6px">
    <div class="bf-method-header bf-collapsible" role="button" tabindex="0" aria-expanded="${expanded ? 'true' : 'false'}" style="display:flex;align-items:center;padding:4px 0;cursor:pointer;font-size:0.62rem;font-weight:600;color:${c.text}">
      ${chevron}<span style="margin-right:6px">${icon}</span>${esc(name)}<span style="color:${c.muted};font-weight:400;margin-left:6px">(${count})</span>
    </div>
    <div class="bf-method-items ${collapsed}" style="${collapsed ? 'display:none;' : ''}padding-left:4px">
      ${itemsHtml}
    </div>
  </div>`;
}

export function bindMethodologyEvents(container: HTMLElement): void {
  container.querySelectorAll('.bf-collapsible').forEach(header => {
    const toggle = () => {
      const items = header.nextElementSibling as HTMLElement | null;
      const chevron = header.querySelector('.bf-chevron') as HTMLElement | null;
      if (!items) return;
      const hidden = items.style.display === 'none';
      items.style.display = hidden ? '' : 'none';
      if (chevron) chevron.style.transform = hidden ? 'rotate(90deg)' : '';
      (header as HTMLElement).setAttribute('aria-expanded', hidden ? 'true' : 'false');
    };
    header.addEventListener('click', toggle);
    header.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  });
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
