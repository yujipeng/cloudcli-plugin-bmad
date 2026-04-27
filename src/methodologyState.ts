import { getInteractionState, setActiveTooltip, setCopiedFeedback, detectInteractionMode } from './interactionMode.js';

interface TC { bg: string; surface: string; border: string; text: string; muted: string; accent: string; dim: string; green: string; yellow: string; red: string; }

export function bindMethodologyInteractions(container: HTMLElement, c: TC, copyFn: (text: string) => Promise<void>): void {
  detectInteractionMode();
  const state = getInteractionState();
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  container.querySelectorAll('.bf-method-item').forEach(el => {
    const item = el as HTMLElement;
    const skill = item.dataset.skill ?? '';
    const desc = item.dataset.desc ?? '';

    item.addEventListener('mouseenter', () => {
      if (state.mode !== 'mouse') return;
      item.style.background = c.dim;
      hoverTimer = setTimeout(() => showTooltip(item, skill, desc, c), 300);
    });

    item.addEventListener('mouseleave', () => {
      item.style.background = '';
      if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
      hideTooltip(item);
    });

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.mode === 'mouse') {
        hideTooltip(item);
        doCopy(item, skill, c, copyFn);
      } else {
        const current = getInteractionState();
        if (current.activeTooltip === skill) {
          hideTooltip(item);
          doCopy(item, skill, c, copyFn);
        } else {
          hideAllTooltips(container);
          showTooltip(item, skill, desc, c);
        }
      }
    });

    item.addEventListener('touchstart', () => {
      longPressTimer = setTimeout(() => {
        hideAllTooltips(container);
        doCopy(item, skill, c, copyFn);
        longPressTimer = null;
      }, 500);
    }, { passive: true });

    item.addEventListener('touchend', () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    });
  });

  document.addEventListener('click', () => hideAllTooltips(container), { once: false });
}

function showTooltip(item: HTMLElement, skill: string, desc: string, c: TC): void {
  hideTooltip(item);
  setActiveTooltip(skill);
  const tip = document.createElement('div');
  tip.className = 'bf-tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.id = `bf-tip-${skill.replace(/[^a-z0-9-]/gi, '')}`;
  item.setAttribute('aria-describedby', tip.id);
  Object.assign(tip.style, {
    position: 'absolute', left: '0', top: '100%', marginTop: '4px',
    background: c.surface, border: `1px solid ${c.border}`, borderRadius: '4px',
    padding: '8px 10px', fontSize: '0.6rem', color: c.text, zIndex: '100',
    maxWidth: '280px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  });
  tip.textContent = `${skill}${desc ? ' — ' + desc : ''}`;
  item.style.position = 'relative';
  item.appendChild(tip);
}

function hideTooltip(item: HTMLElement): void {
  item.querySelector('.bf-tooltip')?.remove();
  item.removeAttribute('aria-describedby');
  setActiveTooltip(null);
}

function hideAllTooltips(container: HTMLElement): void {
  container.querySelectorAll('.bf-tooltip').forEach(t => t.remove());
  container.querySelectorAll('[aria-describedby]').forEach(el => el.removeAttribute('aria-describedby'));
  setActiveTooltip(null);
}

function doCopy(item: HTMLElement, skill: string, c: TC, copyFn: (text: string) => Promise<void>): void {
  setCopiedFeedback(skill);
  copyFn(skill).then(() => {
    showCopiedFeedback(item, c, true);
  }).catch(() => {
    showCopiedFeedback(item, c, false);
  });
}

function showCopiedFeedback(item: HTMLElement, c: TC, success: boolean): void {
  const existing = item.querySelector('.bf-copied');
  if (existing) existing.remove();
  const fb = document.createElement('span');
  fb.className = 'bf-copied';
  fb.setAttribute('aria-live', 'polite');
  Object.assign(fb.style, {
    marginLeft: '8px', fontSize: '0.55rem',
    color: success ? c.green : c.red,
  });
  fb.textContent = success ? '✓ 已复制' : '✗ 复制失败';
  item.appendChild(fb);
  setTimeout(() => {
    fb.remove();
    setCopiedFeedback(null);
  }, 1500);
}
