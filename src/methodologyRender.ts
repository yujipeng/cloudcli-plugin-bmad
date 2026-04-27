import type { MethodologyResponse } from './types.js';

interface TC { bg: string; surface: string; border: string; text: string; muted: string; accent: string; dim: string; green: string; yellow: string; red: string; }

const PHASE_ICONS: Record<string, string> = {
  '1-analysis': '🔍',
  '2-planning': '📋',
  '3-solutioning': '🏗️',
  '4-implementation': '💻',
  'anytime': '🔧',
};

export function renderMethodologySkeleton(c: TC, mono: string): string {
  return `<div class="bf-methodology" style="background:${c.surface};border:1px solid ${c.border};border-radius:4px;padding:16px;margin-top:16px;font-family:${mono}">
    <div style="font-size:0.6rem;color:${c.muted};letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px">方法论导航</div>
    ${[70, 55, 40, 60].map((w, i) => `<div class="bf-skel" style="height:8px;width:${w}%;background:${c.muted};border-radius:2px;margin-bottom:8px;animation-delay:${i * 0.1}s"></div>`).join('')}
  </div>`;
}

export function renderMethodology(data: MethodologyResponse, c: TC, mono: string, container?: HTMLElement): string {
  if (!data.groups || data.groups.length === 0) return '';

  const compact = typeof window !== 'undefined' && (container?.offsetWidth ?? 500) < 400;
  const itemPad = compact ? 'padding:3px 0;font-size:0.58rem;' : 'padding:4px 0;font-size:0.62rem;';

  const sections = data.groups.map(group => {
    const icon = PHASE_ICONS[group.phase] ?? '📂';
    const name = group.displayName || group.phase;
    const count = group.items.length;
    const isAnytime = group.phase === 'anytime';

    const itemsHtml = group.items.length > 0
      ? group.items.map(item => {
        const reqBar = item.required ? `border-left:2px solid ${c.accent};padding-left:8px;` : 'padding-left:10px;';
        const catStyle = item.category === 'agent' ? `color:${c.accent};` : `color:${c.text};opacity:0.85;`;
        return `<div class="bf-method-item" data-skill="${esc(item.skill)}" data-required="${item.required}" style="${reqBar}${catStyle}${itemPad}cursor:pointer;transition:background 0.15s" data-desc="${esc(item.description)}">
          <span style="color:${c.muted};margin-right:6px">[${esc(item.menuCode)}]</span>${esc(item.displayName)}
        </div>`;
      }).join('')
      : `<div style="font-size:0.6rem;color:${c.muted};padding:6px 10px;font-style:italic">暂无可用操作</div>`;

    const collapsed = isAnytime ? '' : 'bf-collapsed';
    const chevron = isAnytime ? '' : `<span class="bf-chevron" style="font-size:0.5rem;margin-right:6px;transition:transform 0.2s;display:inline-block">▶</span>`;

    return `<div class="bf-method-group" style="margin-bottom:8px">
      <div class="bf-method-header ${isAnytime ? '' : 'bf-collapsible'}" role="button" tabindex="0" aria-expanded="${isAnytime ? 'true' : 'false'}" style="display:flex;align-items:center;padding:6px 0;cursor:${isAnytime ? 'default' : 'pointer'};font-size:0.65rem;font-weight:600;color:${c.text}">
        ${chevron}<span style="margin-right:6px">${icon}</span>${esc(name)}<span style="color:${c.muted};font-weight:400;margin-left:6px">(${count})</span>
      </div>
      <div class="bf-method-items ${collapsed}" style="${collapsed ? 'display:none;' : ''}padding-left:4px">
        ${itemsHtml}
      </div>
    </div>`;
  }).join('');

  return `<div class="bf-up bf-methodology" style="background:${c.surface};border:1px solid ${c.border};border-radius:4px;padding:16px;margin-top:16px;font-family:${mono}">
    <div style="font-size:0.6rem;color:${c.muted};letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px">方法论导航</div>
    ${sections}
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
