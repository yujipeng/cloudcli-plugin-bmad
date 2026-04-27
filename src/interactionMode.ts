type InteractionMode = 'mouse' | 'touch';

interface InteractionState {
  mode: InteractionMode;
  activeTooltip: string | null;
  copiedFeedback: string | null;
}

let state: InteractionState = {
  mode: 'mouse',
  activeTooltip: null,
  copiedFeedback: null,
};

const listeners: Array<(s: InteractionState) => void> = [];

export function getInteractionState(): InteractionState {
  return state;
}

export function detectInteractionMode(): InteractionMode {
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  state.mode = hasTouch ? 'touch' : 'mouse';
  return state.mode;
}

export function setActiveTooltip(skillId: string | null): void {
  state = { ...state, activeTooltip: skillId };
  notify();
}

export function setCopiedFeedback(skillId: string | null): void {
  state = { ...state, copiedFeedback: skillId };
  notify();
}

export function subscribe(fn: (s: InteractionState) => void): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notify(): void {
  for (const fn of listeners) fn(state);
}
