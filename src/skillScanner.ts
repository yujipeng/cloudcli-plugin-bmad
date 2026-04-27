import fs from 'node:fs';
import path from 'node:path';
import type { MethodologyItem } from './types.js';

const SKILL_PHASE_MAP: Record<string, string> = {
  'bmad-product-brief': '1-discovery',
  'bmad-prfaq': '1-discovery',
  'bmad-domain-research': '1-discovery',
  'bmad-market-research': '1-discovery',
  'bmad-technical-research': '1-discovery',
  'bmad-document-project': '1-discovery',

  'bmad-create-prd': '2-planning',
  'bmad-edit-prd': '2-planning',
  'bmad-validate-prd': '2-planning',
  'bmad-create-ux-design': '2-planning',

  'bmad-create-architecture': '3-solution-design',
  'bmad-create-epics-and-stories': '3-solution-design',
  'bmad-generate-project-context': '3-solution-design',
  'bmad-check-implementation-readiness': '3-solution-design',

  'bmad-create-story': '4-implementation',
  'bmad-dev-story': '4-implementation',
  'bmad-quick-dev': '4-implementation',
  'bmad-sprint-planning': '4-implementation',
  'bmad-sprint-status': '4-implementation',
  'bmad-correct-course': '4-implementation',
  'bmad-code-review': '4-implementation',
  'bmad-checkpoint-preview': '4-implementation',
  'bmad-qa-generate-e2e-tests': '4-implementation',
  'bmad-retrospective': '4-implementation',

  'bmad-agent-analyst': 'agent',
  'bmad-agent-pm': 'agent',
  'bmad-agent-ux-designer': 'agent',
  'bmad-agent-architect': 'agent',
  'bmad-agent-dev': 'agent',
  'bmad-agent-tech-writer': 'agent',
};

function parseFrontmatter(content: string): { name: string; description: string } | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;
  const block = match[1];
  let name = '';
  let description = '';
  for (const line of block.split('\n')) {
    const m = line.match(/^(\w+):\s*['"]?(.*?)['"]?\s*$/);
    if (!m) continue;
    if (m[1] === 'name') name = m[2];
    if (m[1] === 'description') description = m[2];
  }
  return name ? { name, description } : null;
}

export function scanSkills(projectPath: string): MethodologyItem[] {
  const skillsDir = path.join(projectPath, '.claude', 'skills');
  if (!fs.existsSync(skillsDir)) return [];

  let entries: string[];
  try {
    entries = fs.readdirSync(skillsDir);
  } catch {
    return [];
  }

  const items: MethodologyItem[] = [];
  for (const entry of entries) {
    const skillFile = path.join(skillsDir, entry, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;

    let content: string;
    try {
      content = fs.readFileSync(skillFile, 'utf-8').slice(0, 1000);
    } catch {
      continue;
    }

    const fm = parseFrontmatter(content);
    if (!fm) continue;

    const phase = SKILL_PHASE_MAP[fm.name] ?? 'general';
    const isAgent = phase === 'agent';

    items.push({
      skill: fm.name,
      displayName: fm.name,
      description: fm.description,
      required: false,
      category: isAgent ? 'agent' : 'workflow',
      phase,
      agentName: isAgent ? fm.name : '',
    });
  }

  return items;
}
