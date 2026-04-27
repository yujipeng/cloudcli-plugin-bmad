import type { MethodologyItem, MethodologyCategory } from './types.js';

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function col(fields: string[], index: number): string {
  return (fields[index] ?? '').trim();
}

function inferCategory(agentName: string, workflowFile: string): MethodologyCategory {
  if (agentName) return 'agent';
  if (workflowFile) return 'workflow';
  return 'tool';
}

export function parseMethodologyCsv(csvContent: string): MethodologyItem[] {
  const cleaned = csvContent.replace(/^﻿/, '');
  const lines = cleaned.split('\n').map(l => l.replace(/\r$/, ''));
  const items: MethodologyItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (i === 0 && line.startsWith('module,')) continue;

    const fields = parseCsvLine(line);
    const phase = col(fields, 1);
    if (phase === '_meta') continue;
    if (!phase) continue;

    const workflowFile = col(fields, 5);
    const rawAgentName = col(fields, 8);
    const module = col(fields, 0);

    const isAgentPhase = phase.startsWith('bmad-agent-');
    const agentName = isAgentPhase ? phase : rawAgentName;
    const normalizedPhase = isAgentPhase ? 'agent' : phase;

    items.push({
      skill: workflowFile || agentName,
      displayName: col(fields, 2) || '',
      menuCode: col(fields, 3) || '',
      description: col(fields, 13) || '',
      required: col(fields, 7).toLowerCase() === 'true',
      category: inferCategory(agentName, workflowFile),
      phase: normalizedPhase,
      module,
      agentName,
    });
  }

  return items;
}
