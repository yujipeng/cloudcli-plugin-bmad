export type Locale = 'zh-CN' | 'en';

export interface PluginContext {
  theme: 'dark' | 'light';
  locale?: Locale;
  project: { name: string; path: string } | null;
  session: { id: string; title: string } | null;
}

export interface PluginAPI {
  readonly context: PluginContext;
  onContextChange(callback: (ctx: PluginContext) => void): () => void;
  rpc(method: string, path: string, body?: unknown): Promise<unknown>;
}

export interface PluginModule {
  mount(container: HTMLElement, api: PluginAPI): void | Promise<void>;
  unmount?(container: HTMLElement): void;
}

// ── Bmad Flow types ───────────────────────────────────────────────────

export type Phase = 'discovery' | 'planning' | 'design' | 'development' | 'retrospective';
export type PhaseStatus = 'pending' | 'active' | 'done';
export type StoryStatus = 'backlog' | 'ready-for-dev' | 'in-progress' | 'review' | 'done';

export interface PhaseInfo {
  phase: Phase;
  label: string;
  icon: string;
  status: PhaseStatus;
}

export interface NextAction {
  phase: Phase;
  command: string;
  agent: string;
  agentIcon: string;
  quote: string;
  optional?: boolean;
}

export interface StoryEntry {
  key: string;
  status: StoryStatus;
}

export interface EpicEntry {
  key: string;
  status: string;
  stories: StoryEntry[];
  retroStatus?: string;
}

export interface SprintData {
  project: string;
  epics: EpicEntry[];
  totalStories: number;
  doneStories: number;
}

export interface FlowData {
  phases: PhaseInfo[];
  nextAction: NextAction | null;
  sprint: SprintData | null;
  bmadDetected: boolean;
  configSource: string;
}

// ── Methodology types ────────────────────────────────────────────────

export type MethodologyCategory = 'workflow' | 'agent' | 'tool';

export interface MethodologyItem {
  skill: string;
  displayName: string;
  menuCode: string;
  description: string;
  required: boolean;
  category: MethodologyCategory;
  phase: string;
}

export interface MethodologyGroup {
  phase: string;
  displayName: string;
  items: MethodologyItem[];
}

export interface MethodologyResponse {
  groups: MethodologyGroup[];
  warning?: string;
  error?: string;
  partialFailure?: boolean;
  skippedRows?: number;
}
